import assert from "node:assert/strict";
import test from "node:test";
import { CjsTexturePipelineStepPublishSrgb, Tr2TexturePipeline } from "../../../npm/dist/resource/index.js";
import { Tr2HostBitmap, Tr2RenderContext_GetMainThreadRenderContext } from "../../../npm/dist/trinity/index.js";
import { Tr2RenderContextALStub, Tr2TextureSubresource, Tr2BitmapDimensions, Tr2MsaaDesc } from "../../../npm/dist/trinityal/index.js";
import { PixelFormat as P, TextureType as T, Tr2CpuUsage, Tr2GpuUsage, MakeSrgb } from "../../../npm/dist/global/consts/renderContext/index.js";

/** The native stub retains only one mapped mip; supply each fixture mip when that subresource is read back. */
function sourceTexture(t, format)
{
    const context = Tr2RenderContext_GetMainThreadRenderContext(), previous = context.GetRenderContextAL();
    const al = new Tr2RenderContextALStub();
    al.CreateDevice();
    context.SetRenderContextAL(al);
    const source = context.CreateTexture(Tr2BitmapDimensions.create__TypeFormatWidthHeightDepthMipCount(T.TEX_TYPE_2D, format, 4, 2, 1, 3),
        { gpuUsage: Tr2GpuUsage.SHADER_RESOURCE, cpuUsage: Tr2CpuUsage.READ_OFTEN | Tr2CpuUsage.WRITE_OFTEN, msaa: new Tr2MsaaDesc() });
    const expected = [];
    for (let mip = 0; mip < 3; ++mip)
    {
        const width = Math.max(1, 4 >> mip), height = Math.max(1, 2 >> mip);
        const bytes = new Uint8Array(width * height * 4);
        for (let i = 0; i < bytes.length; ++i) bytes[i] = (i * 37 + mip * 71) & 255;
        expected.push(bytes);
    }
    const readback = source.CreateReadback;
    source.CreateReadback = (region, renderContext) =>
    {
        const mip = region.startMipLevel, width = Math.max(1, 4 >> mip), height = Math.max(1, 2 >> mip);
        const mapped = source.MapForWriting(Tr2TextureSubresource.create__MipLevel(mip), context);
        for (let row = 0; row < height; ++row)
            mapped.data.set(expected[mip].subarray(row * width * 4, (row + 1) * width * 4), row * mapped.pitch);
        source.UnmapForWriting(context);
        return readback.call(source, region, renderContext);
    };
    t.after(() => { source.Destroy(); context.SetRenderContextAL(previous); al.Destroy(); });
    return { source, renderContext: context, expected };
}

for (const format of [ P.PIXEL_FORMAT_R8G8B8A8_UNORM, P.PIXEL_FORMAT_B8G8R8A8_UNORM ])
{
    test("publication relabels every mip without changing RGB or alpha: " + format, async t =>
    {
        const options = sourceTexture(t, format);
        const pipeline = new Tr2TexturePipeline();
        pipeline.steps.push(new CjsTexturePipelineStepPublishSrgb());
        const result = new Tr2HostBitmap();
        assert.deepEqual(pipeline.GetResourceDependencies(), []);
        assert.equal(await pipeline.Execute(result, new Map(), undefined, options), true);
        assert.equal(result.GetFormat(), MakeSrgb(format));
        assert.equal(result.GetMipCount(), 3);
        assert.equal(result.GetWidth(), 4);
        assert.equal(result.GetHeight(), 2);
        for (let mip = 0; mip < 3; ++mip)
            assert.deepEqual(result.GetMipRawData(mip).subarray(0, result.GetMipSize(mip)), options.expected[mip]);
        const original = new Tr2HostBitmap();
        original.CreateFromBitmapDimensions(options.source.GetDesc());
        assert.equal(await original.CopyFromRenderTarget(options.source, options.renderContext), true);
        assert.equal(original.GetFormat(), format);
        for (let mip = 0; mip < 3; ++mip)
            assert.deepEqual(original.GetMipRawData(mip).subarray(0, original.GetMipSize(mip)), options.expected[mip]);
    });
}

test("publication requires an explicit supported source and preserves destination on refusal", async t =>
{
    const options = sourceTexture(t, P.PIXEL_FORMAT_R8G8B8A8_UNORM);
    const step = new CjsTexturePipelineStepPublishSrgb(), result = new Tr2HostBitmap();
    result.Create(1, 1, 1, P.PIXEL_FORMAT_R8G8B8A8_UNORM);
    result.GetRawData().set([ 1, 2, 3, 4 ]);
    assert.equal(await step.Execute(result, new Map()), false);
    assert.equal(await step.Execute(result, new Map(), null, { source: options.source }), false);
    const abort = new AbortController();
    abort.abort();
    assert.equal(await step.Execute(result, new Map(), null, { ...options, signal: abort.signal }), false);
    const source = options.source;
    const getFormat = source.GetFormat;
    source.GetFormat = () => P.PIXEL_FORMAT_R16G16B16A16_FLOAT;
    assert.equal(await step.Execute(result, new Map(), null, options), false);
    source.GetFormat = getFormat;
    assert.deepEqual(result.GetRawData(), new Uint8Array([ 1, 2, 3, 4 ]));
});

test("cancellation during readback discards its result", async t =>
{
    const options = sourceTexture(t, P.PIXEL_FORMAT_R8G8B8A8_UNORM);
    const abort = new AbortController(), original = Tr2HostBitmap.prototype.CopyFromRenderTarget;
    Tr2HostBitmap.prototype.CopyFromRenderTarget = async function (...args)
    {
        const copied = await original.apply(this, args);
        abort.abort();
        return copied;
    };
    t.after(() => { Tr2HostBitmap.prototype.CopyFromRenderTarget = original; });
    const result = new Tr2HostBitmap();
    assert.equal(await new CjsTexturePipelineStepPublishSrgb().Execute(result, new Map(), null, { ...options, signal: abort.signal }), false);
    assert.equal(result.IsValid(), false);
});
