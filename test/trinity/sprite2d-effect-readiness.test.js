import assert from "node:assert/strict";
import test from "node:test";
import { Tr2Sprite2dScene, Tr2Effect } from "../../npm/dist/trinity/index.js";

// Exercise the real effect dependency pull with a resource arriving after the
// scene was created. Reflection is synthetic; no device or asset is needed.
for (const is2dRender of [true, false])
{
  test(`Sprite2D selects a late effect in ${is2dRender ? "2D" : "3D"} and invalidates it on release`, () =>
  {
    let ready = false;
    const resource = { _revision: 0, EnsureGood: () => ready };
    const shader = { GetEffectDescription: () => ({ techniques: [{ passes: [{
      stageInputs: Array.from({ length: 6 }, () => ({ resources: new Map() }))
    }] }] }) };
    const effect = Object.assign(Object.create(Tr2Effect.prototype), {
      resources: [], effectResource: resource, shader: null, _dependencyRevisions: new Map(),
      RebuildCachedData() { this.shader = shader; },
      ReleaseCachedData() { this.shader = null; }
    });
    const scene = Object.assign(Object.create(Tr2Sprite2dScene.prototype), {
      is2dRender, ubershader2d: is2dRender ? effect : null,
      ubershader3d: is2dRender ? null : effect,
      _effect: null, _textureRegisters: new Uint32Array(2)
    });
    assert.equal(scene._SelectEffect(), false);
    ready = true;
    resource._revision++;
    assert.equal(scene._SelectEffect(), true);
    assert.equal(scene._effect, effect);
    assert.equal(effect.shader, shader);
    ready = false;
    resource._revision++;
    assert.equal(scene._SelectEffect(), false);
    assert.equal(scene._effect, null);
    assert.equal(effect.shader, null);
    ready = true;
    resource._revision++;
    assert.equal(scene._SelectEffect(), true);
  });
}
