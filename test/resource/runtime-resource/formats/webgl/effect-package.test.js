import assert from "node:assert/strict";
import test from "node:test";

import { CjsWebglFormat } from "../../../../../src/resource/formats/webgl/index.js";
import {
    inspectGlslEffectContainer
} from "../../../../../src/resource/formats/webgl/core/inspectGlslEffectContainer.js";
import { buildMinimalStagedEffectBytes } from "./synthetic.js";
import { buildContainer, buildShex, opcodeToken, operandToken } from "../dxbc/synthetic.js";
import { CjsCarbonEffectWriter } from "../../../../../src/resource/format/carbonEffect/CjsCarbonEffectWriter.js";
import { CjsCarbonEffectFormat } from "../../../../../src/resource/formats/carbonEffect/index.js";
import { buildSyntheticDescription, blob } from "../../format/carbonEffectSynthetic.js";
import { Tr2EffectRes } from "../../../../../npm/dist/trinity/shader/Tr2EffectRes.js";
import { readEffectFixture, resourceIdentityFixture } from "../../../../support/resourceFixtures.js";

/** Two distinct raster bodies, each shared by two permutation rows. */
function permutationFixture(unsupportedHigh = false)
{
    const writer = new CjsCarbonEffectWriter({ compilerVersion: [ 1, 2, 6, 0 ] });
    writer.addPermutation({ name: "QUALITY", options: [ "LOW", "HIGH" ], defaultOption: 0 });
    writer.addPermutation({ name: "SKINNED", options: [ "OFF", "ON" ], defaultOption: 0 });
    for (let index = 0; index < 4; ++index)
    {
        const high = (index & 1) !== 0;
        const description = buildSyntheticDescription({ label: high ? "High" : "Low" });
        description.techniques.length = 1;
        description.techniques[0].passes.length = 1;
        for (const stage of description.techniques[0].passes[0].stages)
        {
            const instructions = [ opcodeToken(104, 2), 1 ]; // dcl_temps 1
            if (stage.type === 0)
            {
                const output = operandToken(2, [ 0 ]) | 2 | (15 << 4);
                instructions.push(opcodeToken(103, 4), output, 0, 1); // dcl_output_siv o0, position
                instructions.push(opcodeToken(54, 8), output, 0, operandToken(4) | 2, 0, 0, 0, 0x3f800000);
            }
            if (high && unsupportedHigh && stage.type === 1)
            {
                // Typed UAV load: the supported sibling body must not make this
                // requested body drawable, as with TAA's higher quality modes.
                instructions.push(opcodeToken(156, 4) | (3 << 11), operandToken(30, [ 0 ]), 1, 0x4444);
                instructions.push(opcodeToken(163, 7), operandToken(0, [ 0 ]), 0,
                    operandToken(0, [ 0 ]), 0, operandToken(30, [ 0 ]), 1);
            }
            instructions.push(opcodeToken(62, 1));
            stage.shaderData = blob(buildContainer([ { fourCC: "SHEX", payload: buildShex(instructions, {
                programType: stage.type === 0 ? 1 : 0
            }) } ]));
        }
        writer.addBody(index, description);
    }
    return writer.toBytes();
}

test("buildEffect converts compiled-effect bytes without filesystem dependencies", () =>
{
    const source = buildMinimalStagedEffectBytes({ version: 15 });
    const logicalPath = "res:/graphics/effect.dx11/synthetic.sm_hi";
    const result = CjsWebglFormat.buildEffect(source, {
        source: logicalPath,
        sourceIdentity: {
            filePath: logicalPath,
            logicalPath,
            game: "Eve",
            build: "3430261",
            md5: "00000000000000000000000000000000"
        },
        allPermutations: false,
        allowFailures: true
    });

    // `bytes` is the container now, so what is asserted is that it reads back as
    // one. The build result still carries `info`/`glsl` — that is the in-memory
    // translation, which is richer than the wire and is where the provenance and
    // the qualification verdict live.
    assert.equal(inspectGlslEffectContainer(result.bytes).version, 15);
    assert.equal(result.info.sourceIdentity.logicalPath, logicalPath);
    assert.match(result.info.sourceIdentity.sha256, /^[0-9a-f]{64}$/u);
    assert.equal(result.info.permutationMode, "selected");
    assert.equal(result.glsl.stages[0].stageName, "vertex");
    assert.equal(result.qualification.level, "diagnostic");
});

test("buildEffect fails closed unless a diagnostic package is explicit", () =>
{
    assert.throws(
        () => CjsWebglFormat.buildEffect(buildMinimalStagedEffectBytes({ version: 15 }), {
            source: "res:/graphics/effect.dx11/synthetic.sm_hi",
            allPermutations: false
        }),
        /Carbon WebGL target is incomplete/u
    );
});

test("version 15 packaging reports its permutation and body accounting", () =>
{
    const source = buildMinimalStagedEffectBytes({
        version: 15,
        permutations: [
            {
                name: "QUALITY",
                options: [ "LOW", "HIGH" ],
                defaultOption: 1,
                description: "quality",
                type: 1
            },
            {
                name: "SKINNED",
                options: [ "OFF", "ON" ],
                defaultOption: 0,
                description: "skinning",
                type: 1
            }
        ],
        bodyPassCounts: [ 1, 2, 1, 2 ],
        distinctBodyRanges: true
    });
    const result = CjsWebglFormat.buildEffect(source, {
        source: "synthetic.sm_depth",
        allowFailures: true
    });

    // The inspection describes the container, not the chunk package. Four
    // permutations over two distinct bodies is exactly the row-aliasing the
    // container exists to do, so it is what the summary has to show: a tag list
    // could not have said this, and the counts here are the ones a reader of a
    // finished file would need to trust it.
    assert.equal(result.inspection.isContainer, true);
    assert.equal(result.inspection.version, 15);
    assert.equal(result.inspection.recordCount, 4);
    assert.equal(result.inspection.permutationProduct, 4);
    assert.equal(result.inspection.dense, true);
    assert.equal(result.inspection.uniqueBodyCount, 2);
    assert.equal(result.inspection.aliasedRowCount, 2);
    assert.deepEqual(
        result.inspection.permutationAxes.map(({ name, options }) => [ name, options ]),
        [ [ "QUALITY", [ "LOW", "HIGH" ] ], [ "SKINNED", [ "OFF", "ON" ] ] ]
    );
    assert.ok(!("chunks" in result.inspection), "container inspection must not report chunks");
    assert.equal(result.info.formatVersion, 3);
    assert.equal(result.info.sourceBodyCoverage, "all-unique");
    assert.equal(result.info.backendBodyCoverage, "all");
    assert.deepEqual(result.info.completeness, {
        packageValid: true,
        sourceComplete: true,
        backendComplete: false,
        runtimeComplete: false
    });
    assert.equal(result.permutationGraph.variants.length, 4);
    assert.equal(result.permutationGraph.bodies.length, 2);
    assert.equal(result.metadata.bodies.length, 4);
    // These coverage fields used to be gated on a built reflection document.
    // They describe the source and the emitted bodies, so they now stand on the
    // version check that document was only ever a consequence of.
    assert.equal(result.info.sourceBodyCoverage, "all-unique");
    assert.equal(result.info.backendBodyCoverage, "all");

    // What used to be here: every permutation's portable reflection written into
    // the package's RFLX/RBLB chunks and read back through
    // a now-deleted accessor, plus a check that it handed out a
    // defensive copy.
    //
    // That was a property of the chunk format. A Carbon container carries
    // Carbon's own per-stage reflection inside each body description instead —
    // `readGlslEffectContainer` reads it, and `glsl-effect-completeness.test.js` holds
    // the emitted GLSL against it. Serving portable reflection *from a container*
    // is the engine seam's job and does not exist yet, so the property is not
    // restated here in a weaker form; a stand-in assertion would read as coverage
    // that is not there.
    //
    // The body/permutation structure it also depended on is asserted above,
    // against the container: four records over two bodies.

    const selected = CjsWebglFormat.buildEffect(source, {
        source: "synthetic.sm_depth",
        allPermutations: false,
        allowFailures: true
    });
    assert.equal(selected.info.permutationMode, "selected");
    assert.equal(selected.info.backendBodyCoverage, "selected");
    assert.equal(selected.info.sourcePermutationCount, 4);
    assert.equal(selected.info.sourceUniqueBodyCount, 2);
    assert.equal(selected.info.completeness.sourceComplete, true);
    assert.equal(selected.metadata.variants.length, 1);
    assert.equal(selected.metadata.variants[0].permutationIndex, 1);
    assert.deepEqual(
        selected.bytes,
        CjsWebglFormat.buildEffect(source, {
            source: "synthetic.sm_depth",
            allPermutations: false,
            allowFailures: true
        }).bytes
    );
});

test("filtered version 15 Carbon WebGL cannot overclaim backend completeness", () =>
{
    const result = CjsWebglFormat.buildEffect(
        buildMinimalStagedEffectBytes({ version: 15 }),
        {
            source: "synthetic.sm_depth",
            stage: "vertex",
            allowFailures: true
        }
    );

    assert.equal(result.info.sourceBodyCoverage, "all-unique");
    assert.equal(result.info.backendBodyCoverage, "all");
    assert.equal(result.info.backendProgramCoverage, "filtered");
    assert.equal(result.info.completeness.sourceComplete, true);
    assert.equal(result.info.completeness.backendComplete, false);

    // A filtered build still emits a readable container; what it must not do is
    // claim to be complete, which the flags above assert.
    assert.doesNotThrow(() => inspectGlslEffectContainer(result.bytes));
});

test("Carbon WebGL source SHA-256 is an assertion, not caller-authored metadata", () =>
{
    assert.throws(
        () => CjsWebglFormat.buildEffect(
            buildMinimalStagedEffectBytes({ version: 15 }),
            {
                sourceIdentity: { sha256: "0".repeat(64) },
                allowFailures: true
            }
        ),
        /does not match the exact effect input bytes/u
    );
});

test("selected named permutations retain dense rows, aliases and the loader's body index", () =>
{
    const source = permutationFixture();
    const result = CjsWebglFormat.buildEffect(source, {
        mode: "selected",
        permutation: new Map([ [ "QUALITY", "HIGH" ], [ "SKINNED", "ON" ] ])
    });
    assert.equal(result.metadata.bodyIndex, 3);
    assert.deepEqual(result.metadata.selectedOptions.map(({ name, value }) => [ name, value ]),
        [ [ "QUALITY", "HIGH" ], [ "SKINNED", "ON" ] ]);
    assert.deepEqual(result.metadata.variants.map(variant => variant.permutationIndex), [ 3 ]);
    assert.equal(result.info.backendBodyCoverage, "selected");
    assert.equal(result.qualification.ok, true);
    assert.equal(result.inspection.recordCount, 4);
    assert.equal(result.inspection.dense, true);
    const selectedKey = result.permutationGraph.variants[3].bodyKey;
    assert.deepEqual(result.permutationGraph.variants.filter(variant => variant.bodyKey === selectedKey)
        .map(variant => variant.permutationIndex), [ 1, 3 ]);

    const reader = CjsCarbonEffectFormat.read(result.bytes, { emit: "raw" });
    for (let index = 0; index < 4; ++index)
    {
        const description = reader.readDescription(index, { backend: true });
        const sizes = description.techniques[0].passes[0].stages.map(stage => stage.shaderData.size);
        assert.equal(sizes.every(size => size > 0), (index & 1) !== 0,
            "only selected-body aliases carry programs; other rows remain present and empty");
    }
});

test("mode and named requests select bodies without changing bare whole-effect builds", () =>
{
    const source = permutationFixture();
    const request = [ { name: "QUALITY", value: "HIGH" } ];
    const selected = CjsWebglFormat.buildEffect(source, { permutation: request });
    assert.equal(selected.metadata.bodyIndex, 1);
    assert.equal(selected.metadata.variants.length, 1);
    assert.equal(CjsWebglFormat.buildEffect(source, { permutation: [] }).metadata.bodyIndex, 0);
    assert.equal(CjsWebglFormat.buildEffect(source, { allPermutations: false }).info.permutationMode, "selected");
    for (const options of [ {}, { mode: "all", permutation: request }, { mode: "selected", allPermutations: true } ])
    {
        assert.equal(CjsWebglFormat.buildEffect(source, options).info.permutationMode, "all");
    }
    assert.throws(() => CjsWebglFormat.buildEffect(source, { mode: "unknown" }), /mode unknown is not supported/u);
    assert.throws(() => CjsWebglFormat.buildEffect(source, { allPermutations: "false" }), /must be boolean/u);
});

test("named permutation assertions reject unknown, duplicate and malformed requests", () =>
{
    const source = permutationFixture();
    for (const permutation of [
        [ { name: "UNKNOWN", value: "HIGH" } ],
        [ { name: "QUALITY", value: "UNKNOWN" } ],
        [ { name: "QUALITY", value: "LOW" }, { name: "QUALITY", value: "HIGH" } ],
        [ { name: "QUALITY", value: 1 } ],
        { QUALITY: "HIGH" }
    ])
    {
        assert.throws(() => CjsWebglFormat.buildEffect(source, { permutation }),
            /Unknown effect permutation|requested .* but resolved|duplicates axis|malformed|array or Map/u);
    }
});

test("unsupported selected bodies and strict all-mode fail while supported siblings translate", () =>
{
    const source = permutationFixture(true);
    assert.equal(CjsWebglFormat.buildEffect(source, { permutation: [] }).qualification.ok, true);
    for (const options of [ { permutation: [ { name: "QUALITY", value: "HIGH" } ] }, { mode: "all" }, {} ])
    {
        assert.throws(() => CjsWebglFormat.buildEffect(source, options), /Carbon WebGL target is incomplete/u);
    }
    const diagnostic = CjsWebglFormat.buildEffect(source, {
        permutation: [ { name: "QUALITY", value: "HIGH" } ], allowFailures: true
    });
    assert.equal(diagnostic.metadata.bodyIndex, 1);
    assert.deepEqual(diagnostic.glsl.shaders.filter(shader => shader.excluded)
        .map(shader => shader.excluded.opcodeName), [ "ld_uav_typed" ]);
});

test("Tr2EffectRes on-demand translation caches aliases and propagates unsupported requests", () =>
{
    const calls = [];
    const translator = { buildEffect(bytes, options) {
        calls.push(options);
        return CjsWebglFormat.buildEffect(bytes, options);
    } };
    Tr2EffectRes.CommitBackend({ source: "dx11", target: "webgl", translator, permutations: "onDemand" });
    const resource = resourceIdentityFixture(new Tr2EffectRes(), "res:/graphics/effect.dx11/selection.sm_depth");
    const failing = resourceIdentityFixture(new Tr2EffectRes(), "res:/graphics/effect.dx11/unsupported.sm_depth");
    const nameOf = shader => shader.effect.techniques[0].passes[0].stageInputs[0].constants[0].name;
    try
    {
        readEffectFixture(resource, permutationFixture());
        assert.equal(nameOf(resource.GetShaderByIndex(2)), "LowConstant");
        assert.equal(calls.length, 1, "default-body alias does not translate again");
        assert.deepEqual(calls[0].permutation, []);
        assert.equal(nameOf(resource.GetShaderByIndex(3)), "HighConstant");
        assert.equal(nameOf(resource.GetShaderByIndex(1)), "HighConstant");
        assert.equal(calls.length, 2, "named body is translated once for both aliases");
        assert.deepEqual(calls[1].permutation, [ { name: "QUALITY", value: "HIGH" }, { name: "SKINNED", value: "ON" } ]);

        readEffectFixture(failing, permutationFixture(true));
        assert.throws(() => failing.GetShaderByIndex(1), /Carbon WebGL target is incomplete/u);
        assert.equal(nameOf(failing.GetShaderByIndex(2)), "LowConstant", "failure does not poison a supported alias");
        assert.deepEqual([ ...failing._translatedIndices ], [ 0, 2 ]);
    }
    finally
    {
        resource.ReleaseResources();
        failing.ReleaseResources();
    }
});
