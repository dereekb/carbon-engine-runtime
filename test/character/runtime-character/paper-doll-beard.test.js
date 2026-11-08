import test from "node:test";
import assert from "node:assert/strict";
import { CjsPaperDollDefinition, PaperDollTarget } from "../../../npm/dist/character/index.js";

test("beard toggles preserve the selected style and invalidate head and surface composition", () =>
{
    const doll = new CjsPaperDollDefinition();
    const beard = doll.beard;
    beard.Configure([{ id: "shadow", colorAreas: [] }, { id: "stubble", colorAreas: [] }], new Map());
    beard.option = "stubble";
    assert.deepEqual(beard.GetControls(), []);
    assert.equal(beard.Capture().option, "stubble");
    beard.enabled = false;
    assert.equal(beard.Capture().option, "");
    assert.equal(beard.option, "stubble");
    beard.enabled = true;
    assert.equal(beard.Capture().option, "stubble");
    assert.ok(doll.GetLayerOrder(PaperDollTarget.HEAD).includes("beard"));
    assert.ok(!doll.GetLayerOrder(PaperDollTarget.BODY).includes("beard"));
    assert.ok(doll.GetLayerOrder(PaperDollTarget.SURFACE).includes("beard"));
});
