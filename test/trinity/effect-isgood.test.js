import { prepareResourceFixture, failResourceFixture, pendingResourceFixture, purgeResourceFixture, resourceIdentityFixture } from "../support/resourceFixtures.js";
// Tr2Effect.IsGood: "am I good to draw", answered from the effect's own
// resource, after renewing every resource the effect holds.
//
// Ours, not Carbon's (see the method's JSDoc). The two failure modes pinned
// here are both silent: an early exit that leaves later textures unrenewed, and
// a failed texture that switches the whole effect off.
import assert from "node:assert/strict";
import { test, beforeEach, afterEach } from "node:test";

import { Tr2Effect, Tr2Shader, TriTextureParameter } from "../../npm/dist/trinity/index.js";
import { Tr2EffectRes } from "../../npm/dist/trinity/shader/index.js";
import { TriTextureRes } from "../../npm/dist/resource/index.js";


import { blue, BlueAsyncRes, BlueResMan } from "../../npm/dist/blue/index.js";


/** Adds a texture parameter bound to a resource in `state`, counting renewals. */
function addTexture(effect, name, state)
{
  const resource = new TriTextureRes();
  resource._path = `res:/${name}.dds`;
  resource._isLoading = state === "pending";
  resource._isPrepared = state !== "pending";
  resource._isGood = state === "ready";
  const renewals = { count: 0 };
  resource.KeepAlive = () => { renewals.count += 1; };

  const parameter = new TriTextureParameter();
  parameter.SetParameterName(name);
  parameter.SetResource(resource);
  effect.AddResource(parameter);
  return renewals;
}


test("IsGood and its transitional alias renew every texture without an early exit", () =>
{
  const effect = new Tr2Effect();
  const pending = addTexture(effect, "pending", "pending");
  const failed = addTexture(effect, "failed", "failed");
  const ready = addTexture(effect, "ready", "ready");

  effect.IsGood();
  assert.deepEqual([ pending.count, failed.count, ready.count ], [ 1, 1, 1 ]);
  effect.IsGood();
  assert.deepEqual([ pending.count, failed.count, ready.count ], [ 2, 2, 2 ]);
  effect.IsGood();
  assert.deepEqual([ pending.count, failed.count, ready.count ], [ 3, 3, 3 ]);
});


/** Gives an effect a ready effect resource and a resolved shader, as a loaded effect has. */
function makeGood(effect)
{
  const shader = new Tr2Shader();
  const resource = prepareResourceFixture(new Tr2EffectRes());
  resource.GetShader = () => shader;
  effect.effectResource = resource;
  effect.shader = shader;
  return effect;
}


test("a texture that failed or is still loading does not make the effect bad; it is renewed and draws with the fallback", () =>
{
  const effect = makeGood(new Tr2Effect());
  const missing = addTexture(effect, "missing", "failed");
  const loading = addTexture(effect, "loading", "pending");
  assert.equal(effect.IsGood(), true);
  assert.deepEqual([ missing.count, loading.count ], [ 1, 1 ], "KeepAlive renews textures without gating on them");

  effect.KeepAlive();
  assert.deepEqual([ missing.count, loading.count ], [ 2, 2 ], "the effect's KeepAlive is where its children are renewed");
});


test("an effect with a shader but no effect resource is not good", () =>
{
  const effect = new Tr2Effect();
  effect.shader = new Tr2Shader();
  assert.equal(effect.IsGood(), false);
});


test("an effect with no path, or one that resolves to nothing, does not re-initialize when asked", () =>
{
  const effect = new Tr2Effect();
  let initializes = 0;
  effect.Initialize = () => { initializes += 1; return true; };
  for (let frame = 0; frame < 3; frame++) assert.equal(effect.IsGood(), false);
  assert.equal(initializes, 0);

  // No platform is installed here, so an authored .fx has no compiled path to acquire.
  effect.effectFilePath = "res:/graphics/effect/managed/space/test.fx";
  assert.equal(Tr2Effect.convertEffectPath(effect.effectFilePath), "");
  for (let frame = 0; frame < 3; frame++) assert.equal(effect.IsGood(), false);
  assert.equal(initializes, 0);
});


test("an effect whose resource expired re-initializes on the next IsGood and answers false until ready", t =>
{
  const made = [];
  t.mock.method(blue.resMan, "GetResource", path =>
  {
    const resource = pendingResourceFixture(resourceIdentityFixture(new Tr2EffectRes(), path));
    resource.GetShader = () => new Tr2Shader();
    made.push(resource);
    return resource;
  });

  const effect = new Tr2Effect();
  // A compiled path: an authored .fx resolves to nothing until a platform is installed, and is then not acquired.
  effect.effectFilePath = "res:/graphics/effect.dx11/managed/space/test.sm_hi";
  effect.Initialize();
  assert.equal(effect.effectResource, made[0]);
  assert.equal(effect.IsGood(), false, "still loading");
  prepareResourceFixture(made[0]);
  assert.equal(effect.IsGood(), true);

  // Expiry: the manager's link expiry has the owner let go (CjsBlueResManNotify._ExpireLink).
  effect.RemoveCachedData(made[0]);
  assert.equal(effect.effectResource, null);
  assert.equal(effect.shader, null, "the cached shader data went with the resource");

  assert.equal(effect.IsGood(), false, "asked again: it re-initializes and waits");
  assert.equal(made.length, 2, "Initialize acquired the resource again (Tr2Effect.cpp:378-401)");
  assert.equal(effect.effectResource, made[1]);
  assert.equal(effect.IsGood(), false);
  assert.equal(made.length, 2, "a held resource that is loading is not acquired again");

  prepareResourceFixture(made[1]);
  assert.equal(effect.IsGood(), true, "the new resource's completion rebuilt the cached data");
});


test("an effect without a resolved shader is not good", () =>
{
  const effect = new Tr2Effect();
  assert.equal(effect.IsGood(), false);
});


test("a pending effect resource is not good; preparation rebuilds without waiting for use", () =>
{
  const effect = new Tr2Effect();
  const resource = new Tr2EffectRes();
  pendingResourceFixture(resource);
  effect.effectResource = resource;
  blue.resMan.notify.Add(effect, resource, effect, "effectResource");
  effect.shader = new Tr2Shader();      // stale: from before a purge, say

  assert.equal(effect.IsGood(), false, "the resource answers, not a leftover shader");
  assert.equal(effect.IsGood(), false);

  let rebuilds = 0;
  effect.RebuildCachedDataInternal = () => { rebuilds += 1; };
  prepareResourceFixture(resource);
  assert.equal(rebuilds, 1, "completion pushes the rebuild to the registered owner");
  effect.IsGood();
  effect.IsGood();
  assert.equal(rebuilds, 1, "readiness checks do not rebuild again");
});


test("a failed effect resource is not re-registered, so it is not rebuilt every frame", () =>
{
  const effect = new Tr2Effect();
  const resource = new Tr2EffectRes();
  failResourceFixture(resource, new Error("missing effect"));
  effect.effectResource = resource;

  let rebuilds = 0;
  effect.RebuildCachedDataInternal = () => { rebuilds += 1; };
  for (let frame = 0; frame < 5; frame++) assert.equal(effect.IsGood(), false);
  assert.equal(rebuilds, 0);
});


test("pure queries on a purged resource do not revive it", () =>
{
  class CountingResource extends BlueAsyncRes
  {
    reloads = 0;
    Reload() { this.reloads++; pendingResourceFixture(this); }
  }
  const resource = new CountingResource();
  resource._path = "res:/thing.dds";
  blue.resMan._MarkResourcePurged(resource);
  resource.IsPrepared(); resource.IsLoading(); blue.resMan.GetResourceStatus(resource);
  assert.equal(resource.reloads, 0);
  assert.equal(blue.resMan.GetResourceStatus(resource).purged, true);
  resource.IsGood();
  assert.equal(resource.reloads, 1, "use revives");
});


test("draw paths ask the effect: a primitive set skips an effect that is not good", async () =>
{
  const { Tr2LineSet } = await import("../../npm/dist/trinity/index.js");
  const { TriBatchType } = await import("../../npm/dist/global/consts/graphics/index.js");
  const set = new Tr2LineSet();
  set.effect = new Tr2Effect();                       // no shader yet: not good
  let drawn = 0;
  set.GetBatchesImpl = () => { drawn += 1; };

  set.GetBatches({ Commit() {} }, TriBatchType.TRIBATCHTYPE_OPAQUE, null);
  assert.equal(drawn, 0);

  makeGood(set.effect);
  set.GetBatches({ Commit() {} }, TriBatchType.TRIBATCHTYPE_OPAQUE, null);
  assert.equal(drawn, 1);
});


test("a runtime texture parameter renews a cached texture it binds; a texture reference holds nothing to renew", async () =>
{
  const { Tr2RuntimeTextureParameter, Tr2TextureReference } = await import("../../npm/dist/trinity/index.js");
  const texture = new TriTextureRes();
  texture._path = "res:/lut.dds";
  texture._isGood = texture._isPrepared = true;
  let renewals = 0;
  texture.KeepAlive = () => { renewals += 1; };

  const parameter = new Tr2RuntimeTextureParameter();
  parameter.texture = texture;
  parameter.KeepAlive();
  assert.equal(renewals, 1);

  parameter.texture = new Tr2TextureReference();
  parameter.KeepAlive();                        // no throw, nothing to renew
  assert.equal(renewals, 1);
});


test("the light manager asks a profile IsGood where it packs it, and packs none while it loads", async () =>
{
  const { Tr2LightManager } = await import("../../npm/dist/trinity/index.js");
  const { Tr2LightProfileRes } = await import("../../npm/dist/resource/index.js");
  const manager = new Tr2LightManager();
  const profile = new Tr2LightProfileRes();
  profile._isLoading = true;
  let renewals = 0;
  profile.KeepAlive = () => { renewals += 1; };

  assert.equal(manager._ProfileSlot(profile), 0, "loading: no profile");
  // Readiness renews use; repeated checks remain safe.
  assert.equal(renewals, 1, "and asking renewed it once");
});


test("the scene renews the environment maps it publishes, once a frame", async () =>
{
  const { EveSpaceScene, Tr2TextureReference } = await import("../../npm/dist/trinity/index.js");
  const scene = new EveSpaceScene();
  const envMap = new TriTextureRes();
  envMap._path = "res:/env/cube.dds";
  envMap._isGood = envMap._isPrepared = true;
  let renewals = 0;
  envMap.KeepAlive = () => { renewals += 1; };
  scene.envMap1 = envMap;
  scene.envMap2 = new Tr2TextureReference();      // not a cached resource: nothing to renew

  try
  {
    scene.UpdateVariableStore();
    assert.equal(renewals, 1);
    scene.UpdateVariableStore();
    assert.equal(renewals, 2);
  }
  finally
  {
    scene.Destruct();
  }
});

let previousManager;
beforeEach(() => { previousManager=blue.resMan; blue.resMan=new BlueResMan(); });
afterEach(() => { try { blue.resMan.Clear(); } finally { blue.resMan=previousManager; } });
