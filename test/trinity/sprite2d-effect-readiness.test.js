import { blue } from "../../npm/dist/blue/index.js";
import assert from "node:assert/strict";
import test from "node:test";
import { Tr2Sprite2dScene, Tr2Effect, Tr2Sprite2d, Tr2Sprite2dArc, Tr2Sprite2dTexture, Tr2AtlasTexture } from "../../npm/dist/trinity/index.js";
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
    blue.resMan.notify.Add(effect, resource, effect, "effectResource");
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

// Readiness renews use: a failed first slot must not let the other slot expire.
for (const Type of [Tr2Sprite2d, Tr2Sprite2dArc])
{
  test(`${Type.name} renews the secondary texture while the primary is unavailable`, () =>
  {
    const calls = [];
    const texture = (name, good) => ({
      RegisterForChangeNotification() {}, UnregisterForChangeNotification() {},
      IsGood() { calls.push(name); return good; },
      Apply() { assert.fail("Unavailable geometry must not bind textures"); }
    });
    const sprite = new Type();
    sprite.spriteEffect = 64;
    sprite.texturePrimary = texture("primary", false);
    sprite.textureSecondary = texture("secondary", true);
    if (Type === Tr2Sprite2dArc)
    {
      sprite.radius = 10;
      sprite.startAngle = 0;
      sprite.endAngle = 1;
    }
    sprite.GatherSprites({});
    assert.deepEqual(calls, ["primary", "secondary"]);
    assert.equal(sprite.isDirty, true);
  });
}

test("scene readiness renews later atlas slots after missing or failed slots", () =>
{
  let renewals = 0;
  const scene = Object.assign(Object.create(Tr2Sprite2dScene.prototype), {
    _numTexturesUsed: 2,
    _texture: [null, { IsGood() { renewals++; return true; } }]
  });
  assert.equal(scene._TexturesReady(), false);
  scene._texture[0] = { IsGood: () => false };
  assert.equal(scene._TexturesReady(), false);
  assert.equal(renewals, 2);
});

test("sprite atlas readiness follows dynamic resource loss and recovery", () =>
{
  const resource = new BlueAsyncRes();
  resource.GetWidth = () => 8;
  resource.GetHeight = () => 8;
  const atlas = new Tr2AtlasTexture();
  atlas.SetTextureRes(resource);
  const sprite = new Tr2Sprite2dTexture();
  sprite.SetAtlasTexture(atlas);
  assert.equal(sprite.IsGood(), false);
  resource._SetPrepared(true);
  resource._SetGood(true);
  assert.equal(sprite.IsGood(), true);
  resource._SetGood(false);
  assert.equal(sprite.IsGood(), false);
  resource._SetGood(true);
  assert.equal(sprite.IsGood(), true);
  sprite.Destruct();
});

for (const reviveOnUse of [false, true])
{
  test(`Sprite2D waits for ${reviveOnUse ? "manager revival" : "explicit failure retry"} without restarting the load`, () =>
  {
    let loading = false, good = false, reloads = 0;
    const resource = {
      IsLoading: () => loading,
      IsGood() { if (reviveOnUse && !good) loading = true; return good; },
      Reload() { reloads++; loading = true; }
    };
    const scene = Object.assign(Object.create(Tr2Sprite2dScene.prototype), {
      _vertexDecl: 0, _indexBuffer: { IsValid: () => true },
      _vertexBuffer: { IsValid: () => true },
      ubershader2d: { IsGood: () => good, GetEffectRes: () => resource }
    });
    assert.equal(scene._PrepareResourcesForRender(), false);
    assert.equal(scene._PrepareResourcesForRender(), false);
    assert.equal(reloads, reviveOnUse ? 0 : 1);
    loading = false;
    good = true;
    assert.equal(scene._PrepareResourcesForRender(), true);
  });
}


test("UI preparation reacquires expired effect slots and renews both owners", () => {
  const calls = [];
  const resource = { IsLoading: () => false, IsGood: () => true };
  let slot = null;
  const scene = Object.assign(Object.create(Tr2Sprite2dScene.prototype), {
    _vertexDecl: 0, _indexBuffer: { IsValid: () => true }, _vertexBuffer: { IsValid: () => true },
    ubershader2d: { IsGood() { calls.push("2d"); slot = resource; return false; }, GetEffectRes: () => slot },
    ubershader3d: { IsGood() { calls.push("3d"); return false; } }
  });
  assert.equal(scene._PrepareResourcesForRender(), true);
  assert.deepEqual(calls, ["2d", "3d"]);
});
