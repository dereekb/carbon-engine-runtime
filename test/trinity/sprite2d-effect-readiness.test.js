import assert from "node:assert/strict";
import test from "node:test";
import { Tr2Sprite2dScene, Tr2Effect } from "../../npm/dist/trinity/index.js";
import { BlueAsyncRes } from "../../npm/dist/blue/index.js";

// Exercise manager notifications with a resource arriving after the
// scene was created. Reflection is synthetic; no device or asset is needed.
for (const is2dRender of [true, false])
{
  test(`Sprite2D selects a late effect in ${is2dRender ? "2D" : "3D"} and invalidates it on release`, t =>
  {
    const resource = new BlueAsyncRes();
    const shader = { GetEffectDescription: () => ({ techniques: [{ passes: [{
      stageInputs: Array.from({ length: 6 }, () => ({ resources: new Map() }))
    }] }] }) };
    const effect = Object.assign(new Tr2Effect(), {
      RebuildCachedData() { this.shader = shader; },
      ReleaseCachedData() { this.shader = null; }
    });
    effect.effectResource = resource;
    t.after(() => effect.Destruct());
    const scene = Object.assign(Object.create(Tr2Sprite2dScene.prototype), {
      is2dRender, ubershader2d: is2dRender ? effect : null,
      ubershader3d: is2dRender ? null : effect,
      _effect: null, _textureRegisters: new Uint32Array(2)
    });
    assert.equal(scene._SelectEffect(), false);
    resource._SetPrepared(true);
    resource._SetGood(true);
    resource._NotifyRebuildCachedData();
    assert.equal(scene._SelectEffect(), true);
    assert.equal(scene._effect, effect);
    assert.equal(effect.shader, shader);
    resource._SetGood(false);
    resource._NotifyReleaseCachedData();
    assert.equal(scene._SelectEffect(), false);
    assert.equal(scene._effect, null);
    assert.equal(effect.shader, null);
    resource._SetGood(true);
    resource._NotifyRebuildCachedData();
    assert.equal(scene._SelectEffect(), true);
  });
}
