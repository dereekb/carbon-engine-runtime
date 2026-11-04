import assert from "node:assert/strict";
import test from "node:test";

import { Tr2RenderContextALWebgl2, Tr2ShaderALWebgl2 } from "../../../npm/dist/trinityal/webgl2/index.js";
import { ALResult, Tr2ShaderAL, Tr2SamplerDescription, Tr2ResourceSetDescriptionAL, Tr2ResourceSetAL,
    Tr2ConstantUsageAL } from "../../../npm/dist/trinityal/index.js";
import { ShaderType, Topology } from "../../../npm/dist/global/consts/renderContext/index.js";
import { CARBON_BACKEND_ADDRESS_MODES_SYMBOL } from "../../../npm/dist/resource/format/carbonEffect/carbonEffectBackendBlock.js";
import { writeGlslBackendBlock } from "../../../npm/dist/resource/formats/webgl/core/glslBackendBlock.js";
import { FakeWebgl2 } from "./fakeWebgl2.js";

const PIXEL = ShaderType.PIXEL_SHADER;

function device()
{
    const { gl, calls } = FakeWebgl2();
    const context = new Tr2RenderContextALWebgl2({ gl });
    assert.equal(context.CreateDevice({ mode: { width: 32, height: 32 } }), ALResult.S_OK);
    context.SetTopology(Topology.TOP_TRIANGLES);
    return { gl, calls, context };
}

/** Two resources sharing s3, with a generated modes buffer at an arbitrary register. */
function program(context, addressRegister = 5, addressed = true)
{
    const addressName = `cb${addressRegister}`;
    const bindings = [
        { kind: "constantBuffer", registerIndex: 12, name: "cb12", sizeInVec4: 1, style: "array" },
        { kind: "resource", registerIndex: 11, name: "s11", dimensionName: "texture2d", pairedSamplerRegisters: [3] },
        { kind: "resource", registerIndex: 12, name: "s12", dimensionName: "texture2d", pairedSamplerRegisters: [3] }
    ];
    if (addressed) bindings.push({ kind: "constantBuffer", registerIndex: addressRegister, name: addressName,
        sizeInVec4: 13, style: "array", symbol: CARBON_BACKEND_ADDRESS_MODES_SYMBOL });
    const backendBlock = { bytes: writeGlslBackendBlock({ stages: { pixel: { bindings,
        stageOutputs: [{ register: 0, name: "SV_Target0", width: 4, semanticName: "SV_Target", semanticIndex: 0 }] } } }) };
    const sources = [
        [ShaderType.VERTEX_SHADER, "#version 300 es\nvoid main() { gl_Position = vec4(0.0, 0.0, 0.0, 1.0); }"],
        [PIXEL, `#version 300 es
precision highp float;
uniform vec4 cb12[1];
${addressed ? `uniform vec4 ${addressName}[13];` : ""}
uniform sampler2D s11;
uniform sampler2D s12;
layout(location = 0) out vec4 SV_Target0;
void main() { SV_Target0 = cb12[0] + texture(s11, vec2(0.0)) + texture(s12, vec2(0.0))
    ${addressed ? `+ ${addressName}[11] + ${addressName}[12]` : ""}; }`]
    ];
    const shaders = sources.map(([type, source]) =>
    {
        const shader = new Tr2ShaderALWebgl2();
        const registers = type === PIXEL ? [
            { registerType: 1, registerIndex: 3 },
            { registerType: 32, registerIndex: 11 }, { registerType: 32, registerIndex: 12 }
        ] : [];
        assert.equal(shader.Create(type, source, { backendBlock, registers: registers, pipelineInputs: [] }, "addressing", context), ALResult.S_OK);
        return Tr2ShaderAL.create__Shader(shader);
    });
    return context.CreateShaderProgram(shaders);
}

function sampler(context, modes)
{
    return context.CreateSamplerState(Object.assign(new Tr2SamplerDescription(), {
        addressU: modes[0], addressV: modes[1], addressW: modes[2]
    }));
}

function resourceSet(context, linked, state = null)
{
    const description = new Tr2ResourceSetDescriptionAL({ program: linked });
    if (state) description.SetSampler(PIXEL, 3, state);
    return context.CreateResourceSet(description, linked);
}

function draw(context, linked, set)
{
    context.SetShaderProgram(linked);
    context.SetResourceSet(set);
    assert.equal(context.DrawPrimitive(0, 1), ALResult.S_OK);
}

const uploads = (calls, name) => calls.filter(call => call[0] === "uniform4fv" && call[1].name === name);
const addressBinding = linked => linked.TrinityALImpl_GetObject().GetConstantBuffers()
    .find(binding => binding.symbol === CARBON_BACKEND_ADDRESS_MODES_SYMBOL);

test("resolved shared sampler modes reach each resource row through the serialized identity", () =>
{
    const { gl, calls, context } = device();
    const linked = program(context);
    const state = sampler(context, [4, 2, 5]);
    const set = resourceSet(context, linked, state);
    const binding = addressBinding(linked);
    const modes = set._resourceSet.implementation.GetAddressModes(binding);
    assert.deepEqual([...modes.subarray(44)], [4, 2, 5, 0, 4, 2, 5, 0], "both resources take sampler s3");
    assert.ok(modes.subarray(0, 44).every(value => value === 0), "absent resource rows stay zero");
    const native = state.TrinityALImpl_GetObject().GetGpuResource();
    assert.deepEqual([native.parameters.get(gl.TEXTURE_WRAP_S), native.parameters.get(gl.TEXTURE_WRAP_T), native.parameters.get(gl.TEXTURE_WRAP_R)],
        [gl.CLAMP_TO_EDGE, gl.MIRRORED_REPEAT, gl.CLAMP_TO_EDGE]);
    calls.length = 0;
    draw(context, linked, set);
    assert.equal(uploads(calls, "cb5").length, 1);
    assert.equal(uploads(calls, "cb5")[0][2], modes, "upload uses the set's retained array");
    context.Destroy();
    set.Destroy();
});

test("sampler overrides rebuild cached rows and set switches update without draw-time allocation", () =>
{
    const { calls, context } = device();
    const linked = program(context);
    const original = resourceSet(context, linked, sampler(context, [4, 1, 3]));
    const overridden = resourceSet(context, linked, sampler(context, [1, 4, 5]));
    const binding = addressBinding(linked);
    const originalModes = original._resourceSet.implementation.GetAddressModes(binding);
    const overrideModes = overridden._resourceSet.implementation.GetAddressModes(binding);
    const constants = context.CreateConstantBuffer(16, Tr2ConstantUsageAL.ONE_SHOT, new Float32Array([9, 8, 7, 6]));
    context.SetConstants(constants, PIXEL, 12);
    context.SetConstants(constants, PIXEL, 5);
    calls.length = 0;
    draw(context, linked, original);
    draw(context, linked, original);
    draw(context, linked, overridden);
    draw(context, linked, overridden);
    draw(context, linked, original);
    assert.deepEqual(uploads(calls, "cb5").map(call => call[2]), [originalModes, overrideModes, originalModes]);
    assert.equal(uploads(calls, "cb5")[1][2], overrideModes);
    assert.deepEqual([...overrideModes.subarray(44)], [1, 4, 5, 0, 1, 4, 5, 0]);
    assert.deepEqual([...originalModes.subarray(44)], [4, 1, 3, 0, 4, 1, 3, 0], "override does not mutate the old set");
    assert.equal(uploads(calls, "cb12").length, 5);
    assert.ok(uploads(calls, "cb12").every(call => [...call[2]].join() === "9,8,7,6"), "ordinary high register stays native");
    context.Destroy();
    original.Destroy();
    overridden.Destroy();
});

test("missing samplers clear modes, programs retain separate uniform state, and no helper uploads nothing", () =>
{
    const { calls, context } = device();
    const first = program(context, 5);
    const second = program(context, 9);
    const plain = program(context, 5, false);
    const state = sampler(context, [4, 5, 4]);
    const firstSet = resourceSet(context, first, state);
    const secondSet = resourceSet(context, second, state);
    const emptySet = resourceSet(context, first);
    calls.length = 0;
    draw(context, first, firstSet);
    draw(context, second, secondSet);
    draw(context, first, firstSet);
    assert.equal(uploads(calls, "cb5").length, 1, "returning to a program preserves its unchanged uniforms");
    assert.equal(uploads(calls, "cb9").length, 1);
    draw(context, first, emptySet);
    assert.ok(uploads(calls, "cb5").at(-1)[2].every(value => value === 0));
    draw(context, first, new Tr2ResourceSetAL());
    assert.ok(uploads(calls, "cb5").at(-1)[2].every(value => value === 0), "invalid handle also clears modes");
    calls.length = 0;
    draw(context, plain, null);
    assert.equal(calls.filter(call => call[0] === "uniform4fv").length, 0);
    assert.equal(addressBinding(plain), undefined);
    context.Destroy();
    firstSet.Destroy();
    secondSet.Destroy();
    emptySet.Destroy();
});
