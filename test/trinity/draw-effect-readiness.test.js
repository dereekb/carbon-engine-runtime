import assert from "node:assert/strict";
import test from "node:test";
import { Tr2Effect, EveStretch2 } from "../../npm/dist/trinity/index.js";
import { Tr2DebugRenderer, TriDebugTextRenderer } from "../../npm/dist/trinity/core/index.js";
import { TriBatchType } from "../../npm/dist/global/consts/graphics/index.js";
import { BlueAsyncRes } from "../../npm/dist/blue/index.js";

function lateEffect(t)
{
  const resource = new BlueAsyncRes();
  const effect = new Tr2Effect();
  effect.RebuildCachedData = () => { effect.shader = {}; };
  effect.effectResource = resource;
  resource._SetPrepared(true);
  resource._SetGood(true);
  resource._NotifyRebuildCachedData();
  t.after(() => effect.Destruct());
  return effect;
}

test("debug primitives resolve an asynchronously prepared effect before reading its shader", t =>
{
  t.mock.method(TriDebugTextRenderer.prototype, "Render", () => {});
  t.mock.method(TriDebugTextRenderer.prototype, "Clear", () => {});
  const effect = lateEffect(t);
  const renderer = Object.assign(Object.create(Tr2DebugRenderer.prototype), {
    _effect: effect, _lines: [], _triangles: []
  });
  renderer.EndRender({});
  assert.notEqual(effect.shader, null);
});

test("stretch reaches device preparation after its initially null shader becomes ready", t =>
{
  const effect = lateEffect(t);
  let deviceChecks = 0;
  const stretch = Object.assign(Object.create(EveStretch2.prototype), {
    effect, EnsureGood() { deviceChecks++; return false; }
  });
  assert.equal(stretch.GetBatches({}, TriBatchType.TRIBATCHTYPE_ADDITIVE, null, 0), false);
  assert.notEqual(effect.shader, null);
  assert.equal(deviceChecks, 1);
});
