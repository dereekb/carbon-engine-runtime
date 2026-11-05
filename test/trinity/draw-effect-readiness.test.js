import assert from "node:assert/strict";
import test from "node:test";
import { Tr2Effect, EveStretch2, EveStarfield, EveChildBulletStorm, EveChildBehaviorSystem } from "../../npm/dist/trinity/index.js";
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
    effect, IsGood() { deviceChecks++; return false; }
  });
  assert.equal(stretch.GetBatches({}, TriBatchType.TRIBATCHTYPE_ADDITIVE, null, 0), false);
  assert.notEqual(effect.shader, null);
  assert.equal(deviceChecks, 1);
});

for (const [label, Type] of [["starfield", EveStarfield], ["bullet storm", EveChildBulletStorm]])
{
  test(`${label} renews its effect while device preparation is pending`, () =>
  {
    const calls = [];
    const value = Object.assign(Object.create(Type.prototype), {
      display: true, numStars: 1,
      effect: { IsGood() { calls.push("effect"); return false; } },
      IsGood() { calls.push("device"); return false; }
    });
    value.GetBatches({}, TriBatchType.TRIBATCHTYPE_ADDITIVE);
    assert.deepEqual(calls, ["device", "effect"]);
  });
}

test("behaviour systems wait for device preparation before publishing or mapping", () =>
{
  const value = Object.assign(Object.create(EveChildBehaviorSystem.prototype), {
    display: true, _hasUpdated: true, _behaviorGroupLoaded: true,
    IsGood: () => false,
    UpdateBuffer() { assert.fail("must not map unprepared streams"); }
  });
  const renderables = [];
  assert.equal(value.GetRenderables(renderables), renderables);
  assert.deepEqual(renderables, []);
});
