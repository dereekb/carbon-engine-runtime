import test from "node:test";
import assert from "node:assert/strict";
import { CjsPaperDollDefinition } from "../../../npm/dist/character/index.js";
import { CjsSchema } from "../../../npm/dist/blue/schema/index.js";

test("the recipe option is a choice only while a recipe names the part's folder", async () =>
{
    const outer = new CjsPaperDollDefinition().outer, resolved = [];
    outer.Configure([ { id: "robeam01_amarrfoundation", path: "outer/robeam01" }, { id: "recipe", path: "" } ], { resolve: async id => { resolved.push(id); return {}; } });
    // No recipe set it: the style list does not offer it, and resolving it rejects before the source is asked.
    assert.deepEqual(outer.GetOptions().map(option => option.id), [ "robeam01_amarrfoundation" ]);
    await assert.rejects(outer.ResolveOption("recipe"), /^Error: The CjsPaperDollOuter recipe option names no part folder: no recipe set recipePath$/u);
    assert.deepEqual(resolved, []);
    // A recipe names the garment's folder: the option is the garment it set.
    outer.recipePath = "outer/coat01";
    assert.deepEqual(outer.GetOptions().map(option => option.id), [ "robeam01_amarrfoundation", "recipe" ]);
    await outer.ResolveOption("recipe");
    assert.deepEqual(resolved, [ "recipe" ]);
});

test("no editor sees the recipe folder and variation; the factory still sets them", () =>
{
    const outer = new CjsPaperDollDefinition().outer;
    for (const key of [ "recipePath", "recipeVariation" ])
    {
        const edit = CjsSchema.getField(outer.constructor, key).edit;
        assert.deepEqual([ key, Boolean(edit.read), Boolean(edit.write), Boolean(edit.persist) ], [ key, false, false, true ]);
    }
    CjsSchema.setValues(outer, { recipePath: "outer/coat01", recipeVariation: "v9" });
    assert.deepEqual([ outer.recipePath, outer.recipeVariation ], [ "outer/coat01", "v9" ]);
});