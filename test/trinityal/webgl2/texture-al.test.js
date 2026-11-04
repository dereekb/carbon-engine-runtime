import assert from "node:assert/strict";
import { test } from "node:test";

import { Tr2TextureALWebgl2 } from "../../../npm/dist/trinityal/webgl2/index.js";
import { ALResult, Tr2BitmapDimensions, Tr2MsaaDesc, Tr2SubresourceData } from "../../../npm/dist/trinityal/index.js";
import { PixelFormat, TextureType, Tr2ColorSpace, Tr2CpuUsage, Tr2GpuUsage } from "../../../npm/dist/global/consts/renderContext/index.js";
import { HostBitmap } from "../../../npm/dist/global/imageio/index.js";
import { DescribeBitmap } from "../../../npm/dist/trinity/core/Tr2ImageIOHelpers.js";
import { FakeRenderContext, FakeWebgl2 } from "./fakeWebgl2.js";

const S3TC = { COMPRESSED_RGBA_S3TC_DXT1_EXT: 0x83f1 };

function dims(type, format, width, height, depth = 1, mips = 1, arraySize = 1)
{
    return Tr2BitmapDimensions.create__AllFields(type, format, width, height, depth, mips, arraySize);
}

function data(bytes, pitch = 0, slicePitch = 0)
{
    const level = new Tr2SubresourceData();
    level.sysMem = bytes;
    level.sysMemPitch = pitch;
    level.sysMemSlicePitch = slicePitch;
    return level;
}

/** Calls the backend's one positional Create, defaulting what a test leaves out as Tr2TextureAL's overloads do. */
function create(desc, { msaa = new Tr2MsaaDesc(), gpuUsage = Tr2GpuUsage.NONE, cpuUsage = Tr2CpuUsage.NONE, initialData = null } = {}, extensions = {})
{
    const { gl, calls } = FakeWebgl2();
    gl.extensions = extensions;
    const texture = new Tr2TextureALWebgl2();
    const result = texture.Create(desc, msaa, gpuUsage, cpuUsage, initialData, FakeRenderContext(gl));
    return { gl, calls, texture, result };
}

const called = (calls, name) => calls.filter(call => call[0] === name);

test("dx11's refusals hold: a cube must have six faces", () =>
{
    const { result } = create(dims(TextureType.TEX_TYPE_CUBE, PixelFormat.PIXEL_FORMAT_R8G8B8A8_UNORM, 4, 4, 1, 1, 4),
        { gpuUsage: Tr2GpuUsage.SHADER_RESOURCE | Tr2GpuUsage.RENDER_TARGET });
    assert.equal(result, ALResult.E_INVALIDARG);
});

test("WebGL2 refuses unordered access and a multisampled shader resource", () =>
{
    const uav = create(dims(TextureType.TEX_TYPE_2D, PixelFormat.PIXEL_FORMAT_R8G8B8A8_UNORM, 4, 4),
        { gpuUsage: Tr2GpuUsage.UNORDERED_ACCESS | Tr2GpuUsage.RENDER_TARGET });
    assert.equal(uav.result, ALResult.E_INVALIDARG);

    const msaa = new Tr2MsaaDesc();
    msaa.samples = 4;
    const sampled = create(dims(TextureType.TEX_TYPE_2D, PixelFormat.PIXEL_FORMAT_R8G8B8A8_UNORM, 4, 4),
        { gpuUsage: Tr2GpuUsage.RENDER_TARGET | Tr2GpuUsage.SHADER_RESOURCE, msaa });
    assert.equal(sampled.result, ALResult.E_INVALIDARG);
});

test("a multisampled render target is a multisampled renderbuffer", () =>
{
    const msaa = new Tr2MsaaDesc();
    msaa.samples = 4;
    const { gl, calls, texture, result } = create(dims(TextureType.TEX_TYPE_2D, PixelFormat.PIXEL_FORMAT_R8G8B8A8_UNORM, 8, 8),
        { gpuUsage: Tr2GpuUsage.RENDER_TARGET, msaa });

    assert.equal(result, ALResult.S_OK);
    assert.ok(texture.GetRenderbuffer());
    assert.equal(texture.GetGpuResource(), null);
    const [ , , samples, internalFormat, width, height ] = called(calls, "renderbufferStorageMultisample")[0];
    assert.deepEqual([ samples, internalFormat, width, height ], [ 4, gl.RGBA8, 8, 8 ]);
});

test("BC1 with the S3TC extension uploads its blocks compressed", () =>
{
    const blocks = new Uint8Array(8);
    const { calls, result } = create(dims(TextureType.TEX_TYPE_2D, PixelFormat.PIXEL_FORMAT_BC1_UNORM, 4, 4),
        { gpuUsage: Tr2GpuUsage.SHADER_RESOURCE, initialData: [ data(blocks, 8) ] },
        { WEBGL_compressed_texture_s3tc: S3TC });

    assert.equal(result, ALResult.S_OK);
    assert.equal(called(calls, "texStorage2D")[0][3], 0x83f1);
    const upload = called(calls, "compressedTexSubImage2D")[0];
    assert.equal(upload[7], 0x83f1);
    assert.equal(called(calls, "texSubImage2D").length, 0);
});

test("HostBitmap BC1 mip pointers upload exactly one mip, with logical 2x2 and 1x1 tails", () =>
{
    // Native HostBitmap.cpp:437-470 returns a pointer, not a bounded mip.
    // BitmapDimensions.h:194-224 rounds BC storage extents up to whole blocks.
    const bitmap = new HostBitmap();
    assert.equal(bitmap.Create(8, 8, 0, PixelFormat.PIXEL_FORMAT_BC1_UNORM), true);
    for (let mip = 0; mip < 4; ++mip) bitmap.GetMipRawData(mip).fill(mip + 1, 0, bitmap.GetMipSize(mip));
    const described = DescribeBitmap(bitmap);
    assert.deepEqual(described.initialData.map(level => level.sysMem.byteLength), [56, 24, 16, 8]);
    assert.equal(bitmap.GetMipWidth(2), 4, "the native CPU storage extent remains block-rounded");

    const { calls, result } = create(described.desc, { gpuUsage: Tr2GpuUsage.SHADER_RESOURCE, initialData: described.initialData },
        { WEBGL_compressed_texture_s3tc: S3TC });
    assert.equal(result, ALResult.S_OK);
    const uploads = called(calls, "compressedTexSubImage2D");
    assert.deepEqual(uploads.map(call => [call[2], call[5], call[6], call[8].byteLength]),
        [[0, 8, 8, 32], [1, 4, 4, 8], [2, 2, 2, 8], [3, 1, 1, 8]],
        "WebGL S3TC requires ceil(width/4) * ceil(height/4) * 8 bytes and the actual level extents");
    for (let mip = 0; mip < uploads.length; ++mip)
        assert.ok(uploads[mip][8].every(value => value === mip + 1), "no following mip bytes enter this upload");
});

test("BC7 cube and array uploads bound every face's mip bytes, including the sRGB view", () =>
{
    for (const cube of [true, false])
    {
        const bitmap = new HostBitmap();
        const layers = cube ? 6 : 2;
        assert.equal(cube ? bitmap.CreateCube(8, 0, PixelFormat.PIXEL_FORMAT_BC7_UNORM)
            : bitmap.Create2DArray(8, 8, 0, layers, PixelFormat.PIXEL_FORMAT_BC7_UNORM), true);
        for (let layer = 0; layer < layers; ++layer)
            for (let mip = 0; mip < 4; ++mip)
                bitmap.GetMipRawData(mip, layer).fill(layer * 4 + mip + 1, 0, bitmap.GetMipSize(mip));
        const described = DescribeBitmap(bitmap);
        const { gl, calls, texture, result } = create(described.desc,
            { gpuUsage: Tr2GpuUsage.SHADER_RESOURCE, initialData: described.initialData }, { EXT_texture_compression_bptc: {} });
        assert.equal(result, ALResult.S_OK);
        texture.GetShaderResourceTexture(Tr2ColorSpace.COLOR_SPACE_SRGB);
        const uploads = called(calls, cube ? "compressedTexSubImage2D" : "compressedTexSubImage3D");
        assert.equal(uploads.length, layers * 4 * 2, "linear and sRGB views each upload all faces and mips");
        for (let view = 0; view < 2; ++view)
        {
            for (let layer = 0; layer < layers; ++layer)
            {
                for (let mip = 0; mip < 4; ++mip)
                {
                    const upload = uploads[view * layers * 4 + layer * 4 + mip];
                    const extent = 8 >> mip;
                    const pixels = upload[cube ? 8 : 10];
                    assert.equal(upload[2], mip);
                    assert.equal(cube ? upload[1] : upload[5], cube ? gl.TEXTURE_CUBE_MAP_POSITIVE_X + layer : layer);
                    assert.deepEqual(cube ? upload.slice(5, 7) : upload.slice(6, 9), cube ? [extent, extent] : [extent, extent, 1]);
                    assert.equal(pixels.byteLength, mip === 0 ? 64 : 16);
                    assert.ok(pixels.every(value => value === layer * 4 + mip + 1), "only the named face and mip are uploaded");
                }
            }
        }
    }
});

test("compressed upload repacks a pitched block row before passing it to WebGL", () =>
{
    // D3D11_SUBRESOURCE_DATA preserves SysMemPitch (Tr2TextureALDx11.cpp:11-26).
    // WebGL's compressed upload accepts tightly packed blocks, not row padding.
    const source = new Uint8Array(64).fill(0xee);
    source.fill(0x11, 0, 16);
    source.fill(0x22, 24, 40);
    const { calls, result } = create(dims(TextureType.TEX_TYPE_2D, PixelFormat.PIXEL_FORMAT_BC1_UNORM, 8, 8),
        { gpuUsage: Tr2GpuUsage.SHADER_RESOURCE, initialData: [data(source, 24, 48)] },
        { WEBGL_compressed_texture_s3tc: S3TC });
    assert.equal(result, ALResult.S_OK);
    const pixels = called(calls, "compressedTexSubImage2D")[0][8];
    assert.equal(pixels.byteLength, 32);
    assert.ok(pixels.subarray(0, 16).every(value => value === 0x11));
    assert.ok(pixels.subarray(16).every(value => value === 0x22));
});

test("BC3 volume fallback uploads logical mip dimensions after decoding the padded blocks", () =>
{
    const bitmap = new HostBitmap();
    assert.equal(bitmap.CreateVolume(8, 8, 4, 0, PixelFormat.PIXEL_FORMAT_BC3_UNORM), true);
    const described = DescribeBitmap(bitmap);
    const { calls, result } = create(described.desc,
        { gpuUsage: Tr2GpuUsage.SHADER_RESOURCE, initialData: described.initialData });
    assert.equal(result, ALResult.S_OK);
    assert.deepEqual(called(calls, "texSubImage3D").map(call => [call[6], call[7], call[8], call[11].byteLength]),
        [[8, 8, 4, 1024], [4, 4, 2, 128], [2, 2, 1, 16], [1, 1, 1, 4]]);
});

test("a BC3 volume is always decompressed: no extension fills a TEXTURE_3D with blocks", () =>
{
    const blocks = new Uint8Array(16 * 2);
    const { gl, calls, result } = create(dims(TextureType.TEX_TYPE_3D, PixelFormat.PIXEL_FORMAT_BC3_UNORM, 4, 4, 2),
        { gpuUsage: Tr2GpuUsage.SHADER_RESOURCE, initialData: [ data(blocks, 16, 16) ] },
        { WEBGL_compressed_texture_s3tc: S3TC });

    assert.equal(result, ALResult.S_OK);
    assert.equal(called(calls, "texStorage3D")[0][3], gl.RGBA8);
    const upload = called(calls, "texSubImage3D")[0];
    assert.deepEqual([ upload[6], upload[7], upload[8] ], [ 4, 4, 2 ], "width, height, depth");
    assert.equal(upload[11].length, 4 * 4 * 2 * 4, "RGBA8 for every slice");
    assert.equal(called(calls, "compressedTexSubImage3D").length, 0);
});

test("without its extension a BC format falls back to the spec decoder: RGBA8, or float for BC6H", () =>
{
    const bc1 = create(dims(TextureType.TEX_TYPE_2D, PixelFormat.PIXEL_FORMAT_BC1_UNORM, 4, 4),
        { gpuUsage: Tr2GpuUsage.SHADER_RESOURCE, initialData: [ data(new Uint8Array(8), 8) ] });
    assert.equal(bc1.result, ALResult.S_OK);
    assert.equal(called(bc1.calls, "texStorage2D")[0][3], bc1.gl.RGBA8);

    const bc7 = create(dims(TextureType.TEX_TYPE_2D, PixelFormat.PIXEL_FORMAT_BC7_UNORM, 4, 4),
        { gpuUsage: Tr2GpuUsage.SHADER_RESOURCE, initialData: [ data(new Uint8Array(16), 16) ] });
    assert.equal(bc7.result, ALResult.S_OK);
    assert.equal(called(bc7.calls, "texStorage2D")[0][3], bc7.gl.RGBA8);

    const bc6h = create(dims(TextureType.TEX_TYPE_2D, PixelFormat.PIXEL_FORMAT_BC6H_UF16, 4, 4),
        { gpuUsage: Tr2GpuUsage.SHADER_RESOURCE, initialData: [ data(new Uint8Array(16), 16) ] });
    assert.equal(bc6h.result, ALResult.S_OK);
    assert.equal(called(bc6h.calls, "texStorage2D")[0][3], bc6h.gl.RGBA16F);
    assert.ok(called(bc6h.calls, "texSubImage2D")[0][9] instanceof Float32Array);
});

test("the fallback decodes to the specification, not Carbon's Metal output", () =>
{
    // BC1 three-colour index 3: the spec says transparent black; Carbon's
    // Metal decompressor keeps color2's RGB (CE-37).
    const block = new Uint8Array(8);
    new DataView(block.buffer).setUint16(0, 0x001f, true);
    new DataView(block.buffer).setUint16(2, 0xf800, true);
    new DataView(block.buffer).setUint32(4, 0xffffffff, true);

    const { calls } = create(dims(TextureType.TEX_TYPE_2D, PixelFormat.PIXEL_FORMAT_BC1_UNORM, 4, 4),
        { gpuUsage: Tr2GpuUsage.SHADER_RESOURCE, initialData: [ data(block, 8) ] });

    const pixels = called(calls, "texSubImage2D")[0][9];
    assert.deepEqual(Array.from(pixels.subarray(0, 4)), [ 0, 0, 0, 0 ]);
});

test("BGRA8 data is swizzled to RGBA on upload", () =>
{
    const bgra = new Uint8Array([ 1, 2, 3, 4 ]);
    const { calls } = create(dims(TextureType.TEX_TYPE_2D, PixelFormat.PIXEL_FORMAT_B8G8R8A8_UNORM, 1, 1),
        { gpuUsage: Tr2GpuUsage.SHADER_RESOURCE, initialData: [ data(bgra, 4) ] });

    const pixels = called(calls, "texSubImage2D")[0][9];
    assert.deepEqual(Array.from(pixels), [ 3, 2, 1, 4 ]);
});

test("the sRGB view is a second texture, built on first request from the initial data", () =>
{
    const { calls, texture } = create(dims(TextureType.TEX_TYPE_2D, PixelFormat.PIXEL_FORMAT_R8G8B8A8_UNORM, 1, 1),
        { gpuUsage: Tr2GpuUsage.SHADER_RESOURCE, initialData: [ data(new Uint8Array(4), 4) ] });

    const linear = texture.GetShaderResourceTexture(Tr2ColorSpace.COLOR_SPACE_LINEAR);
    assert.equal(called(calls, "createTexture").length, 1);

    const srgb = texture.GetShaderResourceTexture(Tr2ColorSpace.COLOR_SPACE_SRGB);
    assert.notEqual(srgb, linear);
    assert.equal(called(calls, "createTexture").length, 2);
    assert.equal(texture.GetShaderResourceTexture(Tr2ColorSpace.COLOR_SPACE_SRGB), srgb, "built once");
});

test("a texture with no initial data answers its linear texture for sRGB, Carbon's fallback", () =>
{
    const { texture } = create(dims(TextureType.TEX_TYPE_2D, PixelFormat.PIXEL_FORMAT_R8G8B8A8_UNORM, 4, 4),
        { gpuUsage: Tr2GpuUsage.SHADER_RESOURCE | Tr2GpuUsage.RENDER_TARGET });

    assert.equal(texture.GetShaderResourceTexture(Tr2ColorSpace.COLOR_SPACE_SRGB), texture.GetGpuResource());
});

test("CreateReadback copies into a pack buffer, is ready by frame number, and maps it once", async () =>
{
    // Tr2TextureALDx11.cpp:873-933: refuse without CPU read, else copy into a
    // staging resource tagged with the recording frame; Map (:348-372) reads it.
    const { Tr2TextureSubresource } = await import("../../../npm/dist/trinityal/index.js");
    const { gl, calls, texture } = create(dims(TextureType.TEX_TYPE_2D, PixelFormat.PIXEL_FORMAT_R8G8B8A8_UNORM, 2, 2),
        { gpuUsage: Tr2GpuUsage.RENDER_TARGET, cpuUsage: Tr2CpuUsage.READ });
    let rendered = 4;
    const context = { ...FakeRenderContext(gl), GetRecordingFrameNumber: () => 5, GetRenderedFrameNumber: () => rendered };
    const region = Tr2TextureSubresource.create__MipLevel(0);

    const unreadable = create(dims(TextureType.TEX_TYPE_2D, PixelFormat.PIXEL_FORMAT_R8G8B8A8_UNORM, 2, 2), { gpuUsage: Tr2GpuUsage.RENDER_TARGET });
    assert.equal(unreadable.texture.CreateReadback(region, context), null, "no CPU read usage, no readback");

    calls.length = 0;
    const readback = texture.CreateReadback(region, context);

    assert.equal(readback.IsValid(), true);
    assert.deepEqual(called(calls, "readPixels").map(call => call.slice(1)), [ [ 0, 0, 2, 2, gl.RGBA, gl.UNSIGNED_BYTE, 0 ] ],
        "read into the bound pack buffer at offset 0, not into client memory");
    assert.equal(called(calls, "bindBuffer").some(([ , target, buffer ]) => target === gl.PIXEL_PACK_BUFFER && buffer), true);

    assert.equal(readback.IsReady(context), false, "the frame that recorded the copy has not finished");
    rendered = 5;
    assert.equal(readback.IsReady(context), true);

    const mapped = readback.Map(context);
    assert.equal(mapped.result, ALResult.S_OK);
    assert.equal(mapped.pitch, 8);
    assert.equal(mapped.data.length, 16);
    assert.equal(readback.Map(context).data, mapped.data, "mapped once");
    assert.equal(called(calls, "getBufferSubData").length, 1);

    readback.Destroy();
    assert.equal(readback.IsValid(), false);
    assert.equal(called(calls, "deleteBuffer").length, 1);
});
