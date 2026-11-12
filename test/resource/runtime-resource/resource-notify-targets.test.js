import { Tr2SkinnedModel } from "../../../npm/dist/character/trinity/trinityCore/Tr2SkinnedModel.js";
import { Tr2GrannyPrimitiveSet } from "../../../npm/dist/trinity/core/line/Tr2GrannyPrimitiveSet.js";
import { EveTrailsSet } from "../../../npm/dist/trinity/eve/attachment/booster/EveTrailsSet.js";
import { EveTurretSet } from "../../../npm/dist/trinity/eve/attachment/turrets/EveTurretSet.js";
// Meshes, skinned models and effects use manager links; animation migration follows.
import assert from "node:assert/strict";
import { test } from "node:test";
import { BlueAsyncRes, blue, BlueResMan } from "../../../npm/dist/blue/index.js";
import { TriGeometryRes } from "../../../npm/dist/resource/index.js";
import { Tr2Mesh } from "../../../npm/dist/trinity/core/mesh/Tr2Mesh.js";
import { Tr2GrannyAnimation } from "../../../npm/dist/trinity/core/animation/Tr2GrannyAnimation.js";
import { Tr2Effect, Tr2EffectRes } from "../../../npm/dist/trinity/shader/index.js";

/**
 * Mark a resource finished, good or failed, as preparing does.
 * @param {BlueAsyncRes} resource
 * @param {boolean} good
 */
function finish(resource, good)
{
  resource._SetPrepared(true);
  resource._SetGood(good);
  resource._NotifyRebuildCachedData();
}

test("a mesh receives both geometry slots' completion callbacks without polling", () =>
{
  const mesh = new Tr2Mesh(), geometry = new TriGeometryRes(), low = new TriGeometryRes(), seen = recordCachedData(mesh);
  mesh.SetGeometryRes(geometry);
  mesh.SetLowResGeometryRes(low);
  assert.equal(mesh.GetGeometryResource(), low);
  assert.deepEqual(seen, []);

  finish(low, true);
  assert.deepEqual(seen, [["rebuild", low]]);
  mesh.GetGeometryResource();
  mesh.GetGeometryResource();
  assert.deepEqual(seen, [["rebuild", low]]);

  finish(geometry, true);
  assert.deepEqual(seen, [["rebuild", low], ["rebuild", geometry]]);
  assert.equal(mesh.GetGeometryResource(), geometry);
  assert.deepEqual(seen, [["rebuild", low], ["rebuild", geometry]]);

  mesh.Destruct();
});

test("mesh renews both geometry links when the primary is bad and retires the stand-in on completion", () =>
{
  const mesh = new Tr2Mesh(), primary = new TriGeometryRes(), low = new TriGeometryRes();
  mesh.SetGeometryRes(primary);
  mesh.SetLowResGeometryRes(low);
  const manager = blue.resMan, previousTime = manager.activityTime;
  try
  {
    manager.activityTime = 1234;
    assert.equal(mesh.GetGeometryResource(), low);
    assert.deepEqual(manager.notify.GetByOwner(mesh).map(link => link.lastUsed), [1234, 1234]);
    finish(primary, true);
    assert.equal(mesh.lowResGeometry, null);
    assert.equal(manager.notify.GetByResource(low).length, 0);
  }
  finally { mesh.Destruct(); manager.activityTime = previousTime; }
  assert.equal(manager.notify.GetByOwner(mesh).length, 0);
});

test("expired path-owned mesh and model resources reacquire on use but not after destruction", t =>
{
  const manager = blue.resMan, original = manager.GetResource;
  const resource = new TriGeometryRes();
  let acquisitions = 0;
  manager.GetResource = () => { acquisitions++; return resource; };
  t.after(() => { manager.GetResource = original; });
  const mesh = new Tr2Mesh();
  mesh.geometryResPath = "res:/mesh.gr2";
  mesh.SetGeometryRes(resource);
  // Keep this test independent of source-file existence and load-fence logic.
  mesh.InitializeGeometryResource = () => mesh.SetGeometryRes(manager.GetResource(mesh.geometryResPath));
  manager.notify.Clear(resource);
  assert.equal(mesh.geometry, null);
  mesh.GetGeometryResource();
  assert.equal(acquisitions, 1);
  assert.equal(mesh.geometry, resource);
  mesh.Destruct();
  assert.equal(mesh.GetGeometryResource(), null);
  assert.equal(acquisitions, 1);

  const model = new Tr2SkinnedModel();
  model.geometryResPath = "res:/model.gr2";
  model.Initialize();
  manager.notify.Clear(resource);
  assert.equal(model.geometryRes, null);
  model.GetSkeleton();
  assert.equal(model.geometryRes, resource);
  assert.equal(acquisitions, 3);
  model.Destruct();
  assert.equal(model.GetSkeleton(), null);
  assert.equal(acquisitions, 3);
});

test("a shared-geometry animation receives geometry callbacks without polling", () =>
{
  const animation = new Tr2GrannyAnimation(), geometry = new TriGeometryRes(), seen = recordCachedData(animation);
  animation.SetSharedGeometryRes(geometry);
  seen.length = 0;
  animation._RenewResources();
  assert.deepEqual(seen, []);

  finish(geometry, true);
  animation._RenewResources();
  animation._RenewResources();
  assert.deepEqual(seen, [["rebuild", geometry]]);

  geometry._SetGood(false);
  geometry._NotifyReleaseCachedData();
  animation._RenewResources();
  assert.deepEqual(seen.at(-1), ["release", geometry]);

  animation.Destruct();
});

test("a skinned model receives geometry notifications and moves its link on reinitialization", t =>
{
  const manager = blue.resMan, original = manager.GetResource, geometry = new TriGeometryRes();
  manager.GetResource = () => geometry;
  t.after(() => { manager.GetResource = original; });
  const model = new Tr2SkinnedModel(), seen = recordCachedData(model);
  model.geometryResPath = "res:/model.gr2";
  model.Initialize();
  finish(geometry, true);
  model.GetSkeleton();
  model.GetSkeleton();
  assert.deepEqual(seen, [["rebuild", geometry]]);

  // Initializing again relinks the same resource and rebuilds at once, as Carbon's
  // RemoveNotifyTarget and AddNotifyTarget do (Tr2SkinnedModel.cpp:213-222): no release.
  model.Initialize();
  model.GetSkeleton();
  assert.deepEqual(seen, [["rebuild", geometry], ["rebuild", geometry]]);
  model.Destruct();
});

/**
 * Replace an owner's two Carbon methods with recorders, and return what they saw.
 * @param {object} owner
 * @returns {Array<Array>}
 */
function recordCachedData(owner)
{
  const seen = [];
  owner.RebuildCachedData = resource => seen.push(["rebuild", resource]);
  owner.ReleaseCachedData = resource => seen.push(["release", resource]);
  return seen;
}

test("an effect receives manager callbacks without a readiness poll and unregisters on destruction", () =>
{
  const effect = new Tr2Effect(), resource = new BlueAsyncRes(), seen = recordCachedData(effect);
  effect.effectResource = resource;
  blue.resMan.notify.Add(effect, resource, effect, "effectResource");
  assert.equal(blue.resMan.notify.GetByOwner(effect).length, 1);
  assert.equal(effect.IsGood(), false);
  assert.deepEqual(seen, []);

  resource._SetPrepared(true);
  resource._SetGood(true);
  resource._NotifyRebuildCachedData();
  effect.IsGood();
  effect.IsGood();
  assert.deepEqual(seen, [["rebuild", resource]]);

  resource._NotifyRebuildCachedData();
  effect.IsGood();
  assert.deepEqual(seen.at(-1), ["rebuild", resource]);
  assert.equal(seen.length, 2);

  resource._SetGood(false);
  resource._NotifyReleaseCachedData();
  effect.IsGood();
  effect.IsGood();
  assert.deepEqual(seen.at(-1), ["release", resource]);
  assert.equal(seen.length, 3);

  effect.Destruct();
  effect.Destruct();
  assert.equal(blue.resMan.notify.GetByOwner(effect).length, 0);
});

test("a new path releases the previous resource and immediately rebuilds a prepared replacement", t =>
{
  const manager = blue.resMan, original = manager.GetResource;
  const effect = new Tr2Effect(), first = new Tr2EffectRes(), second = new Tr2EffectRes();
  first.GetShader = second.GetShader = () => null;
  manager.GetResource = path => path.includes("first") ? first : second;
  t.after(() => { manager.GetResource = original; });
  const seen = recordCachedData(effect);
  first._SetPrepared(true);
  second._SetPrepared(true);
  effect.SetEffectPathName("res:/first.sm_depth");
  effect.SetEffectPathName("res:/second.sm_depth");
  assert.deepEqual(seen, [["rebuild", first], ["release", first], ["rebuild", second]]);
  assert.equal(blue.resMan.notify.GetByResource(first).length, 0);
  assert.equal(blue.resMan.notify.GetByResource(second).length, 1);
  effect.Destruct();
});

test("Render renews every texture parameter even when the effect resource is bad", () =>
{
  const effect = new Tr2Effect(), resource = new BlueAsyncRes();
  const renewed = [];
  Array.prototype.push.call(effect.resources,
    { KeepAlive() { renewed.push(1); return false; } },
    { KeepAlive() { renewed.push(2); return true; } }
  );
  effect.effectResource = resource;
  effect.Render({ SubmitGeometry() { assert.fail("bad effect must not draw"); } }, {});
  assert.deepEqual(renewed, [1, 2]);
  effect.resources.length = 0;
  effect.Destruct();
});

test("Render reacquires an expired internal resource and draws only after its rebuild callback", t =>
{
  const manager = blue.resMan, original = manager.GetResource;
  const effect = new Tr2Effect(), resource = new BlueAsyncRes();
  let acquisitions = 0, draws = 0;
  manager.GetResource = () => { acquisitions++; return resource; };
  t.after(() => { effect.Destruct(); manager.GetResource = original; });
  const shader = { GetPassCount() { return 1; }, ApplyAllStateForPass() {} };
  // The cached shader data follows the resource: Initialize and the rebuild callback both end here.
  effect.RebuildCachedDataInternal = () => { effect.shader = resource.IsGood() ? shader : null; };
  effect.GetShaderStateInterface = () => effect.shader;
  effect.ApplyMaterialDataForPass = () => {};
  effect.effectFilePath = "res:/effect.fx";
  const callback = { SubmitGeometry() { draws++; } };
  effect.Render(callback, {});
  assert.equal(acquisitions, 1);
  assert.equal(draws, 0);
  finish(resource, true);
  effect.Render(callback, {});
  assert.equal(draws, 1);
  manager.notify.Clear(resource);
  assert.equal(effect.effectResource, null);
  assert.equal(effect.shader, null);
  effect.Render(callback, {});
  assert.equal(acquisitions, 2);
  assert.equal(draws, 2);
  assert.equal(manager.notify.GetByOwner(effect).length, 1);
});

test("trails move their notification link when reinitialized", t =>
{
  const manager = blue.resMan, original = manager.GetResource;
  t.after(() => { manager.GetResource = original; });
  const owner = new EveTrailsSet(), first = new TriGeometryRes(), second = new TriGeometryRes();
  owner.geometryResPath = "res:/trail.gr2";
  manager.GetResource = () => first;
  owner.InitializeGeometryResource();
  assert.equal(manager.notify.GetByOwner(owner).length, 1);
  manager.GetResource = () => second;
  owner.InitializeGeometryResource();
  assert.equal(manager.notify.GetByResource(first).length, 0);
  assert.equal(manager.notify.GetByResource(second).length, 1);
  owner.Destruct();
  assert.equal(manager.notify.GetByOwner(owner).length, 0);
});

test("remaining geometry owners receive completion, expire and reacquire only while alive", t =>
{
  const manager = blue.resMan, original = manager.GetResource;
  t.after(() => { manager.GetResource = original; });
  for (const [owner, slot, path, acquire, use] of [
    [new EveTrailsSet(), "geometryResource", "geometryResPath", value => value.Initialize(), value => value.GetBatches(null, null)],
    [new EveTurretSet(), "geometryResource", "geometryResPath", value => value.InitializeGeometryResource(), value => value.UpdateSyncronous(null, null)],
    [new Tr2GrannyPrimitiveSet(), "grannyRes", "grannyResPath", value => value.SetGrannyResource(), value => value.GetBatchesImpl(null, null, null, 0)]
  ])
  {
    const resource = new TriGeometryRes(), seen = recordCachedData(owner);
    let acquisitions = 0;
    manager.GetResource = () => { acquisitions++; return resource; };
    owner.IsGood = () => false;
    if (owner instanceof EveTurretSet) owner.lodLevel = EveTurretSet.LOD.LOD_HIGHEST;
    owner[path] = "res:/fixture.gr2";
    acquire(owner);
    assert.equal(owner[slot], resource);
    assert.equal(acquisitions, 1);
    finish(resource, true);
    assert.deepEqual(seen, [["rebuild", resource]]);
    manager.notify.Clear(resource);
    assert.equal(owner[slot], null);
    assert.equal(manager.notify.GetByOwner(owner).length, 0);
    use(owner);
    assert.equal(owner[slot], resource);
    assert.equal(acquisitions, 2);
    owner.Destruct();
    use(owner);
    assert.equal(acquisitions, 2);
    assert.equal(manager.notify.GetByOwner(owner).length, 0);
  }
});

test("trails renew material and device readiness even with bad geometry", () =>
{
  const owner = new EveTrailsSet(), resource = new TriGeometryRes(), calls = [];
  owner.geometryResource = resource;
  resource.IsGood = target => { assert.equal(target, owner); calls.push("geometry"); return false; };
  owner.effect = { IsGood() { calls.push("effect"); return false; } };
  owner.IsGood = () => { calls.push("device"); return false; };
  owner.GetBatches(null, null);
  assert.deepEqual(calls, ["geometry", "effect", "device"]);
  owner.Destruct();
});

test("path-acquired geometry owners replace resources and destruct cleanly", t =>
{
  const manager = blue.resMan, original = manager.GetResource;
  let next;
  manager.GetResource = () => next;
  t.after(() => { manager.GetResource = original; });
  const cases = [
    [new Tr2SkinnedModel(), "geometryResPath", "Initialize"],
    [new Tr2GrannyPrimitiveSet(), "grannyResPath", "SetGrannyResource"],
    [new EveTurretSet(), "geometryResPath", "InitializeGeometryResource"]
  ];
  for (const [owner, field, method] of cases)
  {
    if (owner.constructor === EveTurretSet) owner.lodLevel = EveTurretSet.LOD.LOD_HIGHEST;
    owner[field] = "res:/first.gr2";
    const first = next = new TriGeometryRes();
    owner[method]();
    owner[field] = "res:/second.gr2";
    const second = next = new TriGeometryRes();
    owner[method]();
    owner.Destruct();
  }
});
