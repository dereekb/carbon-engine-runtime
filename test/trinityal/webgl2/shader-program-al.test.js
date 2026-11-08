import assert from "node:assert/strict";
import { test } from "node:test";

import { Tr2ShaderALWebgl2, Tr2ShaderProgramALWebgl2 } from "../../../npm/dist/trinityal/webgl2/index.js";
import { ALResult, Tr2ShaderAL } from "../../../npm/dist/trinityal/index.js";
import { ShaderType } from "../../../npm/dist/global/consts/renderContext/index.js";
import * as CcpLog from "../../../npm/dist/global/logging/ccpLog.js";
import { writeGlslBackendBlock } from "../../../npm/dist/resource/formats/webgl/core/glslBackendBlock.js";
import { FakeRenderContext, FakeWebgl2 } from "./fakeWebgl2.js";

/** Carbon links `Tr2ShaderAL` values: wraps each implementation and passes the count. */
function link(shaders)
{
    return [ shaders.map(shader => Tr2ShaderAL.create__Shader(shader)), shaders.length ];
}


const VERTEX = `#version 300 es
in highp vec4 in_POSITION0;
in highp vec2 in_TEXCOORD0;
uniform vec4 cb1[4];
void main() { gl_Position = in_POSITION0; }
`;

const PIXEL = `#version 300 es
precision highp float;
uniform vec4 cb7[2];
uniform mediump sampler2D s0;
uniform mediump sampler2D s1;
out vec4 SV_Target0;
void main() { SV_Target0 = texture(s0, vec2(0.0)) + texture(s1, vec2(0.0)); }
`;

/** A real WebGL2 backend block for the two stages above. */
function block()
{
    return {
        bytes: writeGlslBackendBlock({
            stages: {
                vertex: {
                    bindings: [ { kind: "constantBuffer", registerIndex: 1, name: "cb1", sizeInVec4: 4, style: "array" } ],
                    stageInputs: [
                        { register: 0, name: "in_POSITION0", semanticName: "POSITION", semanticIndex: 0, componentTypeName: "float32", mask: 15 },
                        { register: 1, name: "in_TEXCOORD0", semanticName: "TEXCOORD", semanticIndex: 0, componentTypeName: "float32", mask: 3 }
                    ]
                },
                pixel: {
                    stageOutputs: [ { register: 0, name: "SV_Target0", width: 4, semanticName: "SV_Target", semanticIndex: 0 } ],
                    bindings: [
                        { kind: "constantBuffer", registerIndex: 0, name: "cb7", sizeInVec4: 2, style: "array" },
                        { kind: "resource", registerIndex: 0, name: "s0", dimensionName: "texture2d", pairedSamplerRegisters: [ 3 ] },
                        { kind: "resource", registerIndex: 1, name: "s1", dimensionName: "texture2d", pairedSamplerRegisters: [ 0, 2 ] }
                    ]
                }
            }
        })
    };
}

function shader(gl, type, source, signature = { backendBlock: block(), registers: [] })
{
    const created = new Tr2ShaderALWebgl2();
    const result = created.Create(type, source, signature, "test", FakeRenderContext(gl));
    return { shader: created, result };
}

test("packed light source registers and addressing survive the serialized backend block", () =>
{
    const { gl } = FakeWebgl2();
    const backendBlock = { bytes: writeGlslBackendBlock({ stages: { pixel: { bindings: [ {
        kind: "structuredTexture", registerIndex: 5, name: "cjsLocalLightTexture",
        strideBytes: 0, format: "RGBA32UI", width: 2048,
        cjsSemantic: "packedLocalLights", lightIndexRegister: 5, lightDataRegister: 9,
        lightProfileRegister: 11, dataTexelBase: 131072
    } ] } } }) };
    const vertex = shader(gl, ShaderType.VERTEX_SHADER, VERTEX).shader;
    const pixel = shader(gl, ShaderType.PIXEL_SHADER,
        "uniform highp usampler2D cjsLocalLightTexture; void main() {}", { backendBlock, registers: [] }).shader;
    const program = new Tr2ShaderProgramALWebgl2();
    assert.equal(program.Create(...link([ vertex, pixel ]), FakeRenderContext(gl)), ALResult.S_OK);
    assert.deepEqual(program.GetTextures()[0], {
        stage: ShaderType.PIXEL_SHADER, kind: "structuredTexture", registerIndex: 5,
        name: "cjsLocalLightTexture", unit: 0, samplerRegister: null, samplerConflict: false,
        format: "RGBA32UI", localLightRole: "packed-texture", lightIndexRegister: 5,
        lightDataRegister: 9, lightProfileRegister: 11, width: 2048, dataTexelBase: 131072
    });
});

test("a shader compiles its GLSL and keeps its own stage of the backend block", () =>
{
    const { gl } = FakeWebgl2();
    const { shader: vertex, result } = shader(gl, ShaderType.VERTEX_SHADER, VERTEX);

    assert.equal(result, ALResult.S_OK);
    assert.equal(vertex.IsValid(), true);
    assert.equal(vertex.GetStageBlock().stageInputs.length, 2);
    assert.equal(new TextDecoder().decode(vertex.GetBytecode().bytecode), VERTEX);
});

test("a compile failure answers E_FAIL and keeps the log", () =>
{
    const { gl } = FakeWebgl2();
    const { shader: broken, result } = shader(gl, ShaderType.PIXEL_SHADER, "#error nope");

    assert.equal(result, ALResult.E_FAIL);
    assert.equal(broken.IsValid(), false);
    assert.match(broken.GetCompileLog(), /#error/);
});

test("stages WebGL2 does not have, static samplers and foreign blocks are refused", () =>
{
    const { gl } = FakeWebgl2();

    assert.equal(shader(gl, ShaderType.GEOMETRY_SHADER, VERTEX).result, ALResult.E_INVALIDARG);
    assert.equal(shader(gl, ShaderType.VERTEX_SHADER, VERTEX, { samplers: [ {} ], registers: [] }).result, ALResult.E_INVALIDARG);
    assert.equal(shader(gl, ShaderType.VERTEX_SHADER, VERTEX, { backendBlock: { bytes: new Uint8Array([ 1, 0 ]) } }).result, ALResult.E_INVALIDARG);
    assert.equal(shader(gl, ShaderType.VERTEX_SHADER, "").result, ALResult.E_OUTOFMEMORY);
});

test("a program links its stages, binding vertex inputs to their registers", () =>
{
    const { gl } = FakeWebgl2();
    const vertex = shader(gl, ShaderType.VERTEX_SHADER, VERTEX).shader;
    const pixel = shader(gl, ShaderType.PIXEL_SHADER, PIXEL).shader;
    const program = new Tr2ShaderProgramALWebgl2();

    assert.equal(program.Create(...link([ vertex, pixel ]), FakeRenderContext(gl)), ALResult.S_OK);
    assert.equal(program.IsValid(), true);

    const linked = program.GetGpuResource();
    assert.equal(linked.attributes.get("in_POSITION0"), 0);
    assert.equal(linked.attributes.get("in_TEXCOORD0"), 1);
    assert.equal(program._fragmentOutputMask, 1);
});

test("inactive fragment outputs are omitted while conflicting active locations reject the program", () =>
{
    const { gl } = FakeWebgl2();
    const vertex = shader(gl, ShaderType.VERTEX_SHADER, VERTEX).shader;
    const pixel = shader(gl, ShaderType.PIXEL_SHADER, PIXEL).shader;
    const program = new Tr2ShaderProgramALWebgl2();
    gl.getFragDataLocation = () => -1;
    assert.equal(program.Create(...link([ vertex, pixel ]), FakeRenderContext(gl)), ALResult.S_OK);
    assert.equal(program._fragmentOutputMask, 0);

    gl.getFragDataLocation = () => 2;
    assert.equal(program.Create(...link([ vertex, pixel ]), FakeRenderContext(gl)), ALResult.E_INVALIDARG);
    assert.match(program.GetLinkLog(), /SV_Target0 linked at 2, expected 0/u);
    assert.match(CcpLog.GetLastErrorMessage(), /WebGL2 refused a shader program: Fragment output SV_Target0 linked at 2/u);
    assert.equal(program.IsValid(), false);
    assert.equal(program._fragmentOutputMask, 0);
});

test("linked attribute types preserve float-lowered integer inputs separately from logical reflection", () =>
{
    const { gl, calls } = FakeWebgl2();
    const inputs = [
        { register: 2, name: "in_BLENDINDICES0", semanticName: "BLENDINDICES", semanticIndex: 0, componentTypeName: "uint32", mask: 15 },
        { register: 5, name: "in_TEXCOORD0", semanticName: "TEXCOORD", semanticIndex: 0, componentTypeName: "int32", mask: 15 },
        { register: 7, name: "in_TEXCOORD1", semanticName: "TEXCOORD", semanticIndex: 1, componentTypeName: "uint32", mask: 15 }
    ];
    const backendBlock = { bytes: writeGlslBackendBlock({ stages: { vertex: { stageInputs: inputs } } }) };
    const source = "in highp vec4 in_BLENDINDICES0; in highp ivec4 in_TEXCOORD0; in highp uvec4 in_TEXCOORD1; void main() {}";
    const vertex = shader(gl, ShaderType.VERTEX_SHADER, source, { backendBlock, registers: [] }).shader;
    const program = new Tr2ShaderProgramALWebgl2();
    assert.equal(program.Create(...link([ vertex ]), FakeRenderContext(gl)), ALResult.S_OK);
    assert.deepEqual(program.GetVertexInputs(), inputs, "DXBC component types and registers stay unchanged");
    assert.deepEqual(Array.from(program._vertexAttributeTypes), [ [ 2, "FLOAT" ], [ 5, "INT" ], [ 7, "UINT" ] ]);
    assert.equal(calls.filter(call => call[0] === "getActiveAttrib").length, 3);
    program.Destroy();
    assert.equal(program._vertexAttributeTypes.size, 0);
});

test("a pixel program without output reflection is rejected instead of assuming depth-only", () =>
{
    const { gl } = FakeWebgl2();
    const pixel = shader(gl, ShaderType.PIXEL_SHADER, PIXEL, { registers: [] }).shader;
    const program = new Tr2ShaderProgramALWebgl2();
    assert.equal(program.Create(...link([ shader(gl, ShaderType.VERTEX_SHADER, VERTEX).shader, pixel ]), FakeRenderContext(gl)), ALResult.E_INVALIDARG);
    assert.match(program.GetLinkLog(), /output reflection is missing/u);

    const reflectedPixel = shader(gl, ShaderType.PIXEL_SHADER, PIXEL).shader;
    for (const invalidOutputs of [ undefined, {} ])
    {
        reflectedPixel.GetStageBlock().stageOutputs = invalidOutputs;
        assert.equal(program.Create(...link([ shader(gl, ShaderType.VERTEX_SHADER, VERTEX).shader, reflectedPixel ]), FakeRenderContext(gl)), ALResult.E_INVALIDARG);
        assert.match(program.GetLinkLog(), /output reflection is missing/u);
    }
});

test("the program gives each sampler uniform a unit and records its paired sampler", () =>
{
    const { gl, calls } = FakeWebgl2();
    const program = new Tr2ShaderProgramALWebgl2();
    program.Create(...link([ shader(gl, ShaderType.VERTEX_SHADER, VERTEX).shader, shader(gl, ShaderType.PIXEL_SHADER, PIXEL).shader ]), FakeRenderContext(gl));

    const textures = program.GetTextures();
    assert.deepEqual(textures.map(t => [ t.name, t.unit, t.samplerRegister, t.samplerConflict ]),
        [ [ "s0", 0, 3, false ], [ "s1", 1, 0, true ] ], "s1 is sampled through two samplers: a conflict WebGL2 cannot express");

    const unitCalls = calls.filter(call => call[0] === "uniform1i").map(call => [ call[1], call[2] ]);
    assert.deepEqual(unitCalls, [ [ "s0", 0 ], [ "s1", 1 ] ]);

    const constants = program.GetConstantBuffers();
    assert.deepEqual(constants.map(c => [ c.stage, c.registerIndex, c.name, c.style ]),
        [ [ ShaderType.VERTEX_SHADER, 1, "cb1", "array" ], [ ShaderType.PIXEL_SHADER, 0, "cb7", "array" ] ]);
    assert.ok(constants.every(c => c.location));
});

test("a stage over the sixteen texture-unit budget is refused by name, whatever the device offers", () =>
{
    const { gl } = FakeWebgl2();
    const withTextures = count =>
    {
        const pixel = shader(gl, ShaderType.PIXEL_SHADER, PIXEL).shader;
        const stage = pixel.GetStageBlock();
        stage.bindings = Array.from({ length: count }, (_, registerIndex) =>
            ({ kind: "resource", registerIndex, name: `s${registerIndex}`, dimensionName: "texture2d", pairedSamplerRegisters: [] }));
        return pixel;
    };
    const create = pixel =>
    {
        const program = new Tr2ShaderProgramALWebgl2();
        const result = program.Create(...link([ shader(gl, ShaderType.VERTEX_SHADER, VERTEX).shader, pixel ]), FakeRenderContext(gl));
        return { program, result };
    };

    const atBudget = create(withTextures(16));
    assert.equal(atBudget.result, ALResult.S_OK);
    assert.equal(atBudget.program.GetTextures().length, 16);

    const overBudget = create(withTextures(17));
    assert.equal(overBudget.result, ALResult.E_INVALIDARG);
    assert.equal(overBudget.program.IsValid(), false);
    assert.match(overBudget.program.GetLinkLog(), /uses 17 texture units, over the budget of 16: s0, s1/u);
});

test("a bone block takes a binding point, not a texture unit, so a stage at sixteen textures still links", () =>
{
    const { gl } = FakeWebgl2();
    const vertex = shader(gl, ShaderType.VERTEX_SHADER, `${VERTEX}layout(std140) uniform CjsSb0Block { vec4 data[207]; } CjsSb0;\n`).shader;
    vertex.GetStageBlock().bindings.push({ kind: "structuredUbo", registerIndex: 0, name: "CjsSb0", strideBytes: 48, capacityElements: 69 });
    const pixel = shader(gl, ShaderType.PIXEL_SHADER, PIXEL).shader;
    pixel.GetStageBlock().bindings = Array.from({ length: 16 }, (_, registerIndex) =>
        ({ kind: "resource", registerIndex, name: `s${registerIndex}`, dimensionName: "texture2d", pairedSamplerRegisters: [] }));

    const program = new Tr2ShaderProgramALWebgl2();
    assert.equal(program.Create(...link([ vertex, pixel ]), FakeRenderContext(gl)), ALResult.S_OK);
    assert.equal(program.GetTextures().length, 16);
    assert.deepEqual(program.GetBoneBlocks().map(block => [ block.name, block.byteLength ]), [ [ "CjsSb0", 69 * 48 ] ]);
});

test("dx11's refusals: no stages, an invalid stage, two stages of one type", () =>
{
    const { gl } = FakeWebgl2();
    const context = FakeRenderContext(gl);
    const vertex = shader(gl, ShaderType.VERTEX_SHADER, VERTEX).shader;

    assert.equal(new Tr2ShaderProgramALWebgl2().Create(...link([]), context), ALResult.E_INVALIDARG);
    assert.equal(new Tr2ShaderProgramALWebgl2().Create(...link([ vertex, vertex ]), context), ALResult.E_INVALIDARG);
    assert.equal(new Tr2ShaderProgramALWebgl2().Create(...link([ new Tr2ShaderALWebgl2() ]), context), ALResult.E_INVALIDARG);
});

test("a link failure answers E_FAIL and keeps the log", () =>
{
    const { gl } = FakeWebgl2();
    const vertex = shader(gl, ShaderType.VERTEX_SHADER, `${VERTEX}\n// #nolink`).shader;
    const program = new Tr2ShaderProgramALWebgl2();

    assert.equal(program.Create(...link([ vertex ]), FakeRenderContext(gl)), ALResult.E_FAIL);
    assert.equal(program.IsValid(), false);
    assert.equal(program.GetLinkLog(), "link failed");
});

test("a compute-only program links with a full-screen vertex stage of its own", () =>
{
    const { gl, calls } = FakeWebgl2();
    const backendBlock = { bytes: writeGlslBackendBlock({ stages: { compute: { computeFragment: {
        uavOutputs: [ { register: 0, location: 0, glslName: "SV_Target0" } ]
    } } } }) };
    const compute = shader(gl, ShaderType.COMPUTE_SHADER, PIXEL, { backendBlock, registers: [] }).shader;
    const program = new Tr2ShaderProgramALWebgl2();

    assert.equal(program.Create(...link([ compute ]), FakeRenderContext(gl)), ALResult.S_OK);
    const attached = program.GetGpuResource().shaders;
    assert.equal(attached.length, 2);
    assert.equal(program._fragmentOutputMask, 1);
    assert.match(attached[0].source, /gl_VertexID/);
    assert.ok(calls.some(call => call[0] === "createShader" && call[1] === attached[0]));
});

/** A WebGL2 fake with KHR_parallel_shader_compile, whose completion the test decides. */
function parallelDevice()
{
    const { gl } = FakeWebgl2();
    const extension = { COMPLETION_STATUS_KHR: 0x91B1 };
    gl.extensions = { KHR_parallel_shader_compile: extension };
    const state = { done: false, reads: [] };
    const parameter = gl.getProgramParameter.bind(gl);
    gl.getProgramParameter = (program, name) =>
    {
        state.reads.push(name);
        return name === extension.COMPLETION_STATUS_KHR ? state.done : parameter(program, name);
    };
    const context = { ...FakeRenderContext(gl), GetParallelShaderCompile: () => extension };
    const stage = (type, source) =>
    {
        const created = new Tr2ShaderALWebgl2();
        assert.equal(created.Create(type, source, { backendBlock: block(), registers: [] }, "test", context), ALResult.S_OK);
        return created;
    };
    return { gl, state, context, stage };
}

test("with parallel linking a program exists at once and is good only when the driver is done", () =>
{
    const { gl, state, context, stage } = parallelDevice();
    const program = new Tr2ShaderProgramALWebgl2();
    assert.equal(program.Create(...link([ stage(ShaderType.VERTEX_SHADER, VERTEX), stage(ShaderType.PIXEL_SHADER, PIXEL) ]), context), ALResult.S_OK);
    assert.equal(program.IsValid(), true, "the program exists as soon as the link starts");
    assert.equal(state.reads.includes(gl.LINK_STATUS), false, "Create does not wait for the link");
    assert.equal(program.IsGood(), false);
    assert.equal(program.IsGood(), false, "still linking");
    assert.equal(program._fragmentOutputMask, 0, "laid out only once linked");
    state.done = true;
    assert.equal(program.IsGood(), true);
    assert.equal(program._fragmentOutputMask, 1);
    assert.equal(program.GetGpuResource().attributes.get("in_POSITION0"), 0);
    const reads = state.reads.length;
    assert.equal(program.IsGood(), true);
    assert.equal(state.reads.length, reads, "a good program asks the driver nothing more");
});

test("with parallel linking a failed link or compile is permanently not good and logs once", () =>
{
    const { state, context, stage } = parallelDevice();
    const before = CcpLog.GetLogCounter(CcpLog.LogType.LOGTYPE_ERR);
    const program = new Tr2ShaderProgramALWebgl2();
    // The fake fails a link whose stage carries #nolink; the stage compile itself is not waited for.
    assert.equal(program.Create(...link([ stage(ShaderType.VERTEX_SHADER, VERTEX), stage(ShaderType.PIXEL_SHADER, PIXEL + "\n// #nolink") ]), context), ALResult.S_OK);
    state.done = true;
    assert.equal(program.IsGood(), false);
    assert.equal(program.IsGood(), false);
    assert.equal(program.IsValid(), false, "a failed program is reset, as one refused at Create is");
    assert.equal(CcpLog.GetLogCounter(CcpLog.LogType.LOGTYPE_ERR) - before, 1, "logged once");
    assert.match(CcpLog.GetLastErrorMessage(), /WebGL2 refused a shader program: link failed/u);
    // A stage that failed to compile reports through the program's log.
    const broken = new Tr2ShaderProgramALWebgl2();
    assert.equal(broken.Create(...link([ stage(ShaderType.VERTEX_SHADER, VERTEX), stage(ShaderType.PIXEL_SHADER, PIXEL + "\n#error nope\n// #nolink") ]), context), ALResult.S_OK);
    assert.equal(broken.IsGood(), false);
    assert.match(CcpLog.GetLastErrorMessage(), /#error/u);
});
