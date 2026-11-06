import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileLibrary } from "../../scripts/shadercompiler/compile-library.mjs";
import { CjsCarbonEffectReader } from "../../src/resource/format/carbonEffect/CjsCarbonEffectReader.js";
import { readGlslBackendBlock } from "../../src/resource/formats/webgl/core/glslBackendBlock.js";

const EFFECT = "specialfx/backgroundimage.fx";

/**
 * Compiles one effect for every target and reads its WebGL2 body back.
 *
 * @param {string} effect The library path.
 * @returns {{ written: string[], pass: object, vertex: string, pixel: string, block: object }} What came out.
 */
function compileWebgl2(effect)
{
    const out = mkdtempSync(join(tmpdir(), "cjs-webgl2-"));
    try
    {
        const written = compileLibrary(out, [ effect ]).map(file => file.path);
        const base = effect.replace(/\.fx$/u, "");
        const bytes = new Uint8Array(readFileSync(join(out, `graphics/effect.webgl/cjs/${base}.sm_hi`)));
        const pass = new CjsCarbonEffectReader(bytes, { source: effect }).readDescription(0).techniques[0].passes[0];
        const text = type => new TextDecoder().decode(pass.stages.find(stage => stage.type === type).shaderData.bytes);
        return { written, pass, vertex: text(0), pixel: text(1), block: readGlslBackendBlock(pass.backendBlock.bytes) };
    }
    finally
    {
        rmSync(out, { recursive: true, force: true });
    }
}

test("one effect is written to both trees at every shader model", () =>
{
    const { written } = compileWebgl2(EFFECT);
    for (const tree of [ "effect.webgpu", "effect.webgl" ])
    {
        for (const model of [ "sm_hi", "sm_lo", "sm_depth" ])
        {
            assert.ok(written.includes(`graphics/${tree}/cjs/specialfx/backgroundimage.${model}`));
        }
    }
});

test("an effect the printer refuses is reported and left out of the WebGL tree only", () =>
{
    const out = mkdtempSync(join(tmpdir(), "cjs-webgl2-"));
    try
    {
        const skipped = [];
        // Reads BoneTransforms, a structured buffer the printer does not take yet.
        const effect = "selection/skinned_selectionmask.fx";
        const written = compileLibrary(out, [ effect ], (tree, name) => skipped.push([ tree, name ])).map(file => file.path);
        assert.deepEqual(skipped, [ [ "effect.webgl", effect ] ]);
        assert.equal(written.length, 3);
        assert.ok(written.every(path => path.startsWith("graphics/effect.webgpu/")));
    }
    finally
    {
        rmSync(out, { recursive: true, force: true });
    }
});

test("the WebGL2 pass carries the GLSL block the AL binds from", () =>
{
    const { block } = compileWebgl2(EFFECT);
    const { vertex, pixel } = block.stages;

    assert.deepEqual(vertex.bindings.map(binding => [ binding.kind, binding.registerIndex, binding.name, binding.style ]),
        [ [ "constantBuffer", 1, "vs_cb1", "array" ] ]);
    assert.deepEqual(vertex.stageInputs.map(input => [ input.register, input.name, input.semanticName, input.semanticIndex, input.componentTypeName ]),
        [ [ 0, "in_POSITION0", "POSITION", 0, "float32" ], [ 1, "in_TEXCOORD0", "TEXCOORD", 0, "float32" ] ]);

    assert.deepEqual(pixel.stageOutputs.map(output => [ output.name, output.semanticName, output.semanticIndex ]),
        [ [ "out_SV_Target0", "SV_Target", 0 ] ]);
    const texture = pixel.bindings.find(binding => binding.kind === "resource");
    assert.equal(texture.name, "BackgroundMap");
    assert.equal(texture.samplerType, "sampler2D");
    assert.deepEqual(texture.pairedSamplerRegisters, [ 0 ]);
    assert.deepEqual(pixel.bindings.filter(binding => binding.kind === "constantBuffer").map(binding => [ binding.name, binding.registerIndex, binding.sizeInVec4 ]),
        [ [ "ps_cb2", 2, 118 ], [ "ps_cb0", 0, 4 ] ]);
});

test("the WebGL2 stages are GLSL ES 3.00 that keeps WebGL2's clip convention", () =>
{
    const { vertex, pixel } = compileWebgl2(EFFECT);

    assert.ok(vertex.startsWith("#version 300 es\n"));
    assert.ok(pixel.startsWith("#version 300 es\n"));
    assert.ok(vertex.includes("uniform vec3 ssyf;"));
    assert.ok(vertex.includes("gl_Position.z = 2.0 * gl_Position.z - gl_Position.w;"));

    // Stages link varyings by name.
    assert.ok(vertex.includes("out vec2 v_TEXCOORD0;"));
    assert.ok(pixel.includes("in vec2 v_TEXCOORD0;"));

    // Vector comparisons are functions; a sampler is not a value.
    assert.ok(pixel.includes("lessThan(uv, vec2(0.0))"));
    assert.ok(!/\bSampler\b|BackgroundMapSampler/u.test(pixel));
    assert.ok(!/__/u.test(vertex + pixel));
});
