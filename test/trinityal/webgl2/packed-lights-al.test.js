import assert from "node:assert/strict";
import test from "node:test";
import { Tr2RenderContextALWebgl2, Tr2ShaderALWebgl2, Tr2ResourceSetALWebgl2 } from "../../../npm/dist/trinityal/webgl2/index.js";
import { ALResult, Tr2BufferDescriptionAL, Tr2MemoryCounterAL, Tr2ResourceSetDescriptionAL, Tr2ShaderAL } from "../../../npm/dist/trinityal/index.js";
import { PixelFormat, ShaderType, Tr2CpuUsage, Tr2GpuUsage } from "../../../npm/dist/global/consts/renderContext/index.js";
import { writeGlslBackendBlock } from "../../../npm/dist/resource/formats/webgl/core/glslBackendBlock.js";
import { FakeWebgl2 } from "./fakeWebgl2.js";

/** A fake device with exact snapshots of integer subimage uploads and unpack state. */
function device(t)
{
    const { gl, calls } = FakeWebgl2();
    const state = new Map([
        [ gl.MAX_TEXTURE_SIZE, 16384 ], [ gl.UNPACK_ALIGNMENT, 8 ], [ gl.UNPACK_ROW_LENGTH, 7 ],
        [ gl.UNPACK_SKIP_ROWS, 2 ], [ gl.UNPACK_SKIP_PIXELS, 3 ],
        [ gl.UNPACK_FLIP_Y_WEBGL, true ], [ gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true ],
        [ gl.PIXEL_UNPACK_BUFFER_BINDING, null ]
    ]);
    const parameter = gl.getParameter, bind = gl.bindBuffer, store = gl.pixelStorei;
    gl.getParameter = name => state.has(name) ? state.get(name) : parameter(name);
    gl.bindBuffer = (target, value) =>
    {
        if (target === gl.PIXEL_UNPACK_BUFFER) state.set(gl.PIXEL_UNPACK_BUFFER_BINDING, value);
        bind(target, value);
    };
    gl.pixelStorei = (name, value) => { state.set(name, value); store(name, value); };
    const uploads = [];
    gl.texSubImage2D = (target, level, x, y, width, height, format, type, words, offset = 0) =>
    {
        assert.equal(target, gl.TEXTURE_2D);
        assert.equal(level, 0);
        assert.equal(format, gl.RGBA_INTEGER);
        assert.equal(type, gl.UNSIGNED_INT);
        assert.ok(words instanceof Uint32Array);
        assert.equal(state.get(gl.UNPACK_ROW_LENGTH), 0);
        assert.equal(state.get(gl.UNPACK_SKIP_ROWS), 0);
        assert.equal(state.get(gl.UNPACK_SKIP_PIXELS), 0);
        assert.equal(state.get(gl.PIXEL_UNPACK_BUFFER_BINDING), null);
        uploads.push({ texture: gl.getParameter(gl.TEXTURE_BINDING_2D), x, y, width, height,
            words: words.slice(offset, offset + width * height * 4) });
    };
    const context = new Tr2RenderContextALWebgl2({ gl });
    assert.equal(context.CreateDevice({ mode: { width: 8, height: 8 } }), ALResult.S_OK);
    t.after(() => context.Destroy());
    return { gl, calls, context, state, uploads };
}

/** Existing typed-buffer source contract; data is deliberately passed with raw float bit patterns. */
function buffer(t, context, words, format = PixelFormat.PIXEL_FORMAT_R32_UINT, cpu = Tr2CpuUsage.WRITE)
{
    const count = format === PixelFormat.PIXEL_FORMAT_R32G32B32A32_FLOAT ? words.length / 4 : words.length;
    const description = Tr2BufferDescriptionAL.create__Format(format, count, Tr2GpuUsage.SHADER_RESOURCE, cpu);
    const value = context.CreateBuffer(description, words);
    assert.ok(value);
    t.after(() => value.Destroy());
    return value;
}

/** A wire-layout fixture uses non-default source registers; the sampler's own register is unrelated. */
function program(t, context, options = {})
{
    const binding = {
        kind: "structuredTexture", registerIndex: 2, name: "packedLights", format: "RGBA32UI", width: 4,
        cjsSemantic: "packedLocalLights", lightIndexRegister: 5, lightDataRegister: 9,
        lightProfileRegister: 10, dataTexelBase: 6, ...options
    };
    const block = { bytes: writeGlslBackendBlock({ stages: { pixel: { bindings: [ binding ],
        stageOutputs: [ { register: 0, name: "SV_Target0", width: 4, semanticName: "SV_Target", semanticIndex: 0 } ] } } }) };
    const stages = [];
    for (const [ type, source, signature ] of [
        [ ShaderType.VERTEX_SHADER, "#version 300 es\nvoid main(){gl_Position=vec4(0.0);}", { registers: [] } ],
        [ ShaderType.PIXEL_SHADER, "#version 300 es\nprecision highp float; uniform highp usampler2D packedLights; out vec4 SV_Target0; void main(){SV_Target0=vec4(texelFetch(packedLights,ivec2(0),0));}",
            { backendBlock: block, registers: [ { registerType: 32, registerIndex: 5 }, { registerType: 32, registerIndex: 9 } ] } ]
    ])
    {
        const implementation = new Tr2ShaderALWebgl2();
        assert.equal(implementation.Create(type, source, signature, "packed-light fixture", context), ALResult.S_OK);
        const shader = Tr2ShaderAL.create__Shader(implementation);
        stages.push(shader);
        t.after(() => shader.Destroy());
    }
    const value = context.CreateShaderProgram(stages);
    assert.ok(value);
    t.after(() => value.Destroy());
    return value;
}

/** Retains both original source registers through the ordinary copied description. */
function resourceSet(t, context, linked, indices, data)
{
    const description = new Tr2ResourceSetDescriptionAL({ program: linked });
    if (indices) description.SetSrv__BufferAL(ShaderType.PIXEL_SHADER, 5, indices);
    if (data) description.SetSrv__BufferAL(ShaderType.PIXEL_SHADER, 9, data);
    const set = context.CreateResourceSet(description, linked);
    description.ClearResources();
    assert.ok(set);
    t.after(() => set.Destroy());
    return set;
}

/** Reconstructs a small wire fixture's uploaded texels, including row boundaries and zero padding. */
function pixels(uploads, view)
{
    const result = new Uint32Array(view.width * view.height * 4);
    for (const upload of uploads)
        for (let row = 0; row < upload.height; ++row)
            result.set(upload.words.subarray(row * upload.width * 4, (row + 1) * upload.width * 4),
                ((upload.y + row) * view.width + upload.x) * 4);
    return result;
}

test("packed views resolve both registers, preserve raw words and padding, and share across sets", t =>
{
    const { gl, calls, context, state, uploads } = device(t);
    const indexWords = new Uint32Array([ 0, 3, 5, 7, 0xffffffff, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61 ]);
    const dataWords = new Uint32Array([ 0x7fc12345, 0xffc54321, 0x80000000, 0x3f800000, 1, 2, 3, 4,
        5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26 ]);
    const indices = buffer(t, context, indexWords), data = buffer(t, context, dataWords);
    const linked = program(t, context);
    const first = resourceSet(t, context, linked, indices, data), second = resourceSet(t, context, linked, indices, data);
    const view = first._resourceSet.implementation.GetUnits()[0].packedLocalLights;
    assert.equal(second._resourceSet.implementation.GetUnits()[0].packedLocalLights, view);
    assert.equal(view.indexWords.buffer, indices.TrinityALImpl_GetObject().GetCpuBytes().buffer, "no combined CPU copy");
    assert.equal(view.dataWords.buffer, data.TrinityALImpl_GetObject().GetCpuBytes().buffer);
    assert.equal(view.tail.byteLength, 16);
    const before = new Map(state);
    const previousTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, previousTexture);
    assert.equal(view.index._GetPackedShaderResourceTexture(view), view.texture);
    assert.equal(gl.getParameter(gl.TEXTURE_BINDING_2D), previousTexture);
    assert.deepEqual(state, before, "unpack state is restored");
    const expected = new Uint32Array(view.width * view.height * 4);
    expected.set(indexWords);
    expected.set(dataWords, view.dataTexelBase * 4);
    assert.deepEqual(pixels(uploads, view), expected, "indices, NaN payloads, signed zero and padding are exact");
    assert.equal(calls.filter(call => call[0] === "texStorage2D" && call[3] === gl.RGBA32UI).length, 1);
    const count = uploads.length;
    context.SetResourceSet(first);
    context._ApplyTextureUnits();
    context.SetResourceSet(second);
    context._ApplyTextureUnits();
    assert.equal(uploads.length, count, "set switches and unchanged draws do not upload again");
    assert.ok(calls.some(call => call[0] === "bindTexture" && call[2] === view.texture));
    context.SetResourceSet(null);
});

test("successful writes, range unmaps and copies invalidate only the affected source span", t =>
{
    const { context, uploads } = device(t);
    const indices = buffer(t, context, new Uint32Array(32));
    const data = buffer(t, context, new Uint32Array(16), PixelFormat.PIXEL_FORMAT_R32G32B32A32_FLOAT);
    const set = resourceSet(t, context, program(t, context, { dataTexelBase: 8 }), indices, data);
    const view = set._resourceSet.implementation.GetUnits()[0].packedLocalLights;
    view.index._GetPackedShaderResourceTexture(view);
    uploads.length = 0;
    assert.equal(data.UpdateBuffer(4, 4, new Uint32Array([ 0x7fc98765 ]), context), ALResult.S_OK);
    view.index._GetPackedShaderResourceTexture(view);
    assert.equal(uploads.length, 1);
    assert.deepEqual([ uploads[0].x, uploads[0].y, uploads[0].width, uploads[0].height ], [ 0, 2, 1, 1 ]);
    assert.equal(uploads[0].words[1], 0x7fc98765);
    uploads.length = 0;
    const mapped = indices.MapForWriting(context);
    mapped.data[68] = 47;
    indices.UnmapForWriting__WrittenRange(68, 1, context);
    view.index._GetPackedShaderResourceTexture(view);
    assert.deepEqual([ uploads[0].x, uploads[0].y, uploads[0].width, uploads[0].height ], [ 0, 1, 1, 1 ]);
    assert.equal(uploads[0].words[1], 47);
    uploads.length = 0;
    assert.equal(context.CopySubBuffer(indices, 0, data, 4, 4), ALResult.S_OK);
    view.index._GetPackedShaderResourceTexture(view);
    assert.equal(uploads.length, 1);
    assert.equal(uploads[0].words[0], 0x7fc98765);
    uploads.length = 0;
    assert.equal(context.CopySubBuffer(indices, 129, data, 0, 4), ALResult.E_INVALIDARG);
    view.index._GetPackedShaderResourceTexture(view);
    assert.equal(uploads.length, 0, "a rejected copy does not dirty the view");
    indices.UnmapForWriting(context);
    view.index._GetPackedShaderResourceTexture(view);
    assert.equal(uploads.length, 1);
    assert.deepEqual([ uploads[0].width, uploads[0].height ], [ 4, 2 ], "whole-map writes upload whole source rows");
});

test("copied descriptions retain the source pair and its counted texture until the last set releases it", t =>
{
    const { calls, context } = device(t);
    const indices = buffer(t, context, new Uint32Array(8)), data = buffer(t, context, new Uint32Array(8));
    const linked = program(t, context, { dataTexelBase: 2 });
    const before = Tr2MemoryCounterAL.gpuMemoryTextureEst;
    const first = resourceSet(t, context, linked, indices, data), second = resourceSet(t, context, linked, indices, data);
    const view = first._resourceSet.implementation.GetUnits()[0].packedLocalLights;
    const texture = view.texture;
    assert.equal(Tr2MemoryCounterAL.gpuMemoryTextureEst - before, view.width * view.height * 16);
    indices.Destroy();
    data.Destroy();
    first.Destroy();
    assert.equal(view.index._GetPackedShaderResourceTexture(view), texture);
    second.Destroy();
    assert.equal(view.texture, null);
    assert.equal(view.indexWords, null);
    assert.equal(view.dataWords, null);
    assert.equal(Tr2MemoryCounterAL.gpuMemoryTextureEst, before);
    assert.equal(calls.filter(call => call[0] === "deleteTexture" && call[1] === texture).length, 1);
});

test("source recreation preserves old copied sets and creates a distinct pair for new descriptions", t =>
{
    const { context } = device(t);
    const indices = buffer(t, context, new Uint32Array(8)), data = buffer(t, context, new Uint32Array(8));
    const linked = program(t, context, { dataTexelBase: 4 });
    const oldSet = resourceSet(t, context, linked, indices, data);
    const old = oldSet._resourceSet.implementation.GetUnits()[0].packedLocalLights;
    assert.equal(indices.Create(Tr2BufferDescriptionAL.create__Format(PixelFormat.PIXEL_FORMAT_R32_UINT, 12,
        Tr2GpuUsage.SHADER_RESOURCE, Tr2CpuUsage.WRITE), new Uint32Array(12), context), ALResult.S_OK);
    const newSet = resourceSet(t, context, linked, indices, data);
    const current = newSet._resourceSet.implementation.GetUnits()[0].packedLocalLights;
    assert.notEqual(current, old);
    assert.notEqual(current.texture, old.texture);
    oldSet.Destroy();
    assert.equal(old.texture, null);
    assert.ok(current.texture);
    assert.equal(data.TrinityALImpl_GetObject()._packedViews.length, 1);
});

test("invalid layouts and incomplete source pairs reject while two absent slots keep a null binding", t =>
{
    const { context, state, gl } = device(t);
    const indices = buffer(t, context, new Uint32Array(20)), data = buffer(t, context, new Uint32Array(4));
    const indexImpl = indices.TrinityALImpl_GetObject(), dataImpl = data.TrinityALImpl_GetObject();
    assert.equal(indexImpl._GetPackedShaderResource(dataImpl, 4, 4), null, "index bytes may not overlap the data base");
    assert.equal(indexImpl._GetPackedShaderResource(dataImpl, 3, 8), null, "the emitted bit addressing needs a power of two");
    state.set(gl.MAX_TEXTURE_SIZE, 4);
    assert.equal(indexImpl._GetPackedShaderResource(dataImpl, 4, 16), null, "height must fit the device");
    state.set(gl.MAX_TEXTURE_SIZE, 16384);
    const linked = program(t, context);
    const absent = resourceSet(t, context, linked, null, null);
    assert.equal(absent._resourceSet.implementation.GetUnits()[0].resource, null);
    const description = new Tr2ResourceSetDescriptionAL({ program: linked });
    description.SetSrv__BufferAL(ShaderType.PIXEL_SHADER, 5, indices);
    const implementation = new Tr2ResourceSetALWebgl2();
    assert.equal(implementation.Create(description, linked, context), ALResult.E_INVALIDARG);
    assert.equal(implementation._description, null, "a rejected pair releases its copied handles");
    description.ClearResources();
    implementation.Destroy();
});

test("native-capacity data base uploads only actual compact source ranges without a combined CPU image", t =>
{
    const { context, uploads } = device(t);
    const indices = buffer(t, context, new Uint32Array([ 3, 3, 0, 0, 0 ]));
    const data = buffer(t, context, new Uint32Array(36));
    const view = indices.TrinityALImpl_GetObject()._GetPackedShaderResource(data.TrinityALImpl_GetObject(), 2048, 2097152);
    assert.ok(view);
    assert.equal(view.height, 1025);
    view.index._GetPackedShaderResourceTexture(view);
    assert.equal(uploads.reduce((sum, upload) => sum + upload.words.byteLength, 0), 32 + 144);
    assert.equal(view.indexWords.byteLength, 20);
    assert.equal(view.dataWords.byteLength, 144);
});
