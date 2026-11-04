import { readEffectFixture } from "../../../support/resourceFixtures.js";
import test from "node:test";
import assert from "node:assert/strict";

import { CjsCarbonEffectWriter } from "../../../../src/resource/format/carbonEffect/CjsCarbonEffectWriter.js";
import { buildSyntheticDescription, SYNTHETIC_PERMUTATIONS } from "../format/carbonEffectSynthetic.js";
import { Tr2EffectRes } from "../../../../npm/dist/trinity/shader/Tr2EffectRes.js";
import { Tr2Effect } from "../../../../npm/dist/trinity/shader/Tr2Effect.js";
import { blue, BlueResMan } from "../../../../npm/dist/blue/index.js";

// A browser backend translates the default permutation at load and hands the
// resource a translator for the rest; the first request for another permutation
// translates it and reads its body from the translation.

/** A container whose four indices carry bodies labelled by `labels`. */
function container(labels)
{
    const writer = new CjsCarbonEffectWriter({ compilerVersion: [ 1, 2, 6, 0 ], sourceHash: "0123456789abcdef0123456789abcdef" });
    for (const axis of SYNTHETIC_PERMUTATIONS) writer.addPermutation(axis);
    labels.forEach((label, index) => writer.addBody(index, buildSyntheticDescription({ label })));
    return writer.toBytes();
}

const nameOf = shader => shader.effect.techniques[0].passes[0].stageInputs[0].constants[0].name;

test("a permutation the load did not translate is translated on first request", () =>
{
    const calls = [];
    // DoLoad installs a translator itself when it translates, and clears any
    // earlier one, so a hand-installed translator goes on after the load.
    const res = readEffectFixture(new Tr2EffectRes(), container([ "U", "U", "D", "U" ]));
    res.SetPermutationTranslator(permutation =>
    {
        calls.push(permutation);
        return { bytes: container([ "X", "T", "X", "X" ]), indices: [ 1 ] };
    }, [ 2 ]);

    assert.equal(nameOf(res.GetShaderByIndex(2)), "DConstant", "the loaded body serves its own index");
    assert.equal(calls.length, 0);

    assert.equal(nameOf(res.GetShaderByIndex(1)), "TConstant", "index 1 comes from its translation");
    assert.deepEqual(calls, [ [ { name: "SKINNED", value: "1" }, { name: "DETAIL", value: "off" } ] ]);

    res.ReleaseResources();
    assert.equal(nameOf(res.GetShaderByIndex(1)), "TConstant");
    assert.equal(calls.length, 1, "a translated permutation is not translated twice");
});

test("a translation that lacks the requested body is an error, not a wrong body", () =>
{
    const res = readEffectFixture(new Tr2EffectRes(), container([ "U", "U", "D", "U" ]));
    res.SetPermutationTranslator(() => ({ bytes: container([ "X", "X", "X", "X" ]), indices: [ 3 ] }), [ 2 ]);

    assert.throws(() => res.GetShaderByIndex(0), /produced no body/);
});

test("without a translator every index reads from the loaded container", () =>
{
    const res = readEffectFixture(new Tr2EffectRes(), container([ "A", "B", "C", "C" ]));

    assert.equal(nameOf(res.GetShaderByIndex(1)), "BConstant");
});

test("an unsupported permutation stays local to its effect during manager notification", t =>
{
    const previous = blue.resMan;
    const manager = blue.resMan = new BlueResMan({ autoPurgePolicy: false });
    const failed = new Tr2Effect(), ready = new Tr2Effect();
    t.after(() => { failed.Destruct(); ready.Destruct(); manager.Clear(); blue.resMan = previous; });
    const res = readEffectFixture(new Tr2EffectRes(), container([ "A", "B", "C", "C" ]));
    res.SetPermutationTranslator(() => { throw new Error("unsupported synthetic shader instruction"); }, [1, 2, 3]);
    failed.options = [{ name: "SKINNED", value: "0" }, { name: "DETAIL", value: "off" }];
    ready.options = [{ name: "SKINNED", value: "1" }, { name: "DETAIL", value: "off" }];
    failed.effectResource = res;
    ready.effectResource = res;
    res._SetPrepared(true);
    res._SetGood(true);
    assert.doesNotThrow(() => res._NotifyRebuildCachedData());
    assert.equal(failed.shader, null);
    assert.equal(failed.IsGood(), false);
    assert.ok(ready.shader, "later targets still rebuild");
    assert.equal(ready.IsGood(), true);
    assert.throws(() => res.GetShaderByIndex(0), /unsupported synthetic/, "exact-index tooling remains strict");
});
