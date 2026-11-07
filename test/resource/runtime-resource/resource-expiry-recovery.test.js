import assert from "node:assert/strict";
import { test } from "node:test";
import { blue, BlueResMan, MotherLode } from "../../../npm/dist/blue/index.js";
import { CjsSchema } from "../../../npm/dist/blue/schema/index.js";
import { TriGeometryRes, TriGrannyRes } from "../../../npm/dist/resource/index.js";
import { Tr2SkinnedModel } from "../../../npm/dist/character/trinity/trinityCore/Tr2SkinnedModel.js";
import { Tr2GrannyAnimation } from "../../../npm/dist/trinity/core/animation/Tr2GrannyAnimation.js";
import { Tr2GrannyPrimitiveSet } from "../../../npm/dist/trinity/core/line/Tr2GrannyPrimitiveSet.js";
import { Tr2Mesh } from "../../../npm/dist/trinity/core/mesh/Tr2Mesh.js";
import { EveTrailsSet } from "../../../npm/dist/trinity/eve/attachment/booster/EveTrailsSet.js";
import { EveTurretSet } from "../../../npm/dist/trinity/eve/attachment/turrets/EveTurretSet.js";
import { Tr2Effect, Tr2EffectRes } from "../../../npm/dist/trinity/shader/index.js";

const PATH = "res:/recovery/fixture.gr2";
const CLIP = "res:/recovery/clip.gr2";

/** One rig with one clip, in the decoded shape the animation reads. */
function grannyFile()
{
  const identity3 = [ 1, 0, 0, 0, 1, 0, 0, 0, 1 ];
  const identity4 = [ 0, 0, 0, 1 ];
  return {
    models: [ {
      name: "Ship",
      skeleton: {
        bones: [ { name: "Root", parentIndex: -1, position: [ 0, 0, 0 ], orientation: identity4, scaleShear: identity3 } ]
      },
      meshBindings: []
    } ],
    meshes: [],
    animations: [ { name: "Move", duration: 1, trackGroups: [] } ]
  };
}

/** A prepared resource at a path, as MotherLode would hand it back. */
function prepared(resource, path, ext = "")
{
  resource._path = path;
  resource._ext = ext;
  resource._SetPrepared(true);
  resource._SetGood(true);
  return resource;
}

/** A manager with a deterministic clock, counting every acquisition by path. */
function harness(t, make = () => new TriGeometryRes())
{
  const previous = blue.resMan;
  let time = 1000;
  const manager = blue.resMan = new BlueResMan({ motherLode: new MotherLode({ now: () => time }), autoPurgePolicy: false });
  manager.linkExpirySeconds = 1;

  const handles = new Map();
  const acquired = [];
  const requests = [];
  manager.GetResource = (path, options = {}) =>
  {
    acquired.push(path);
    requests.push([ path, options.ex ?? "" ]);
    if (!handles.has(path)) handles.set(path, prepared(make(), path));
    return handles.get(path);
  };

  t.after(() => { blue.resMan = previous; });

  return {
    manager,
    acquired,
    requests,
    handles,
    /** Stops all use, then lets the sweep run past expiry. */
    stopPastExpiry()
    {
      time += 5000;
      manager.activityTime = time;
      manager.PurgeInactive({ time });
    },
    tick(milliseconds)
    {
      time += milliseconds;
      manager.activityTime = time;
    }
  };
}

/** Schema values with the live resource slot taken out: the slot is what expires. */
function values(owner, slot)
{
  const out = CjsSchema.getValues(owner, {}, { persistOnly: true });
  delete out[slot];
  return JSON.parse(JSON.stringify(out));
}

const OWNERS = [
  {
    name: "Tr2SkinnedModel",
    slot: "geometryRes",
    path: "geometryResPath",
    create() { const owner = new Tr2SkinnedModel(); owner.geometryResPath = PATH; owner.Initialize(); return owner; },
    use(owner) { owner.GetSkeleton(); }
  },
  {
    name: "Tr2GrannyPrimitiveSet",
    slot: "grannyRes",
    path: "grannyResPath",
    create()
    {
      const owner = new Tr2GrannyPrimitiveSet();
      owner.IsGood = () => false;
      owner.grannyResPath = PATH;
      owner.SetGrannyResource();
      return owner;
    },
    use(owner) { owner.GetBatchesImpl(null, null, null, 0); }
  },
  {
    name: "Tr2Mesh",
    slot: "geometry",
    path: "geometryResPath",
    create() { const owner = new Tr2Mesh(); owner.geometryResPath = PATH; owner.Initialize(); return owner; },
    use(owner) { owner.GetGeometryResource(); }
  },
  {
    name: "EveTrailsSet",
    slot: "geometryResource",
    path: "geometryResPath",
    create()
    {
      const owner = new EveTrailsSet();
      owner.IsGood = () => false;
      owner.geometryResPath = PATH;
      owner.Initialize();
      return owner;
    },
    use(owner) { owner.GetBatches(null, null); }
  },
  {
    name: "EveTurretSet",
    slot: "geometryResource",
    path: "geometryResPath",
    create()
    {
      const owner = new EveTurretSet();
      owner.lodLevel = EveTurretSet.LOD.LOD_HIGHEST;
      owner.geometryResPath = PATH;
      owner.InitializeGeometryResource();
      return owner;
    },
    use(owner) { owner.UpdateSyncronous(null, null); }
  }
];

for (const fixture of OWNERS)
{
  test(`${fixture.name} recovers at use after expiry with its values unchanged`, async t =>
  {
    const run = harness(t);
    const owner = fixture.create();
    const resource = owner[fixture.slot];
    assert.ok(resource, "acquired from its path");

    // A mesh waits for its load fence, which settles a tick after a prepared resource.
    await new Promise(setImmediate);
    const before = values(owner, fixture.slot);

    run.stopPastExpiry();
    assert.equal(owner[fixture.slot], null, "expiry drops the resource");
    assert.equal(owner[fixture.path], PATH, "expiry keeps the path");
    assert.deepEqual(values(owner, fixture.slot), before, "values survive expiry");
    assert.equal(run.manager.notify.GetByOwner(owner).length, 0);

    fixture.use(owner);
    assert.equal(owner[fixture.slot], resource, "use reacquires");
    assert.equal(run.manager.notify.GetByOwner(owner).length, 1);
    assert.deepEqual(values(owner, fixture.slot), before, "values match after recovery");

    run.tick(600);
    fixture.use(owner);
    run.tick(600);
    run.manager.PurgeInactive({ time: run.manager.activityTime });
    assert.equal(owner[fixture.slot], resource, "continued use keeps it");

    owner.Destruct();
  });
}

test("Tr2Effect recovers at use after expiry with its values unchanged", t =>
{
  const run = harness(t, () => new Tr2EffectRes());
  const effect = new Tr2Effect();
  effect.effectFilePath = "res:/recovery/effect.fx";
  effect.Initialize();
  const resource = effect.effectResource;
  assert.ok(resource);
  const before = values(effect, "effectResource");
  const actual = effect.actualEffectFilePath;

  run.stopPastExpiry();
  assert.equal(effect.effectResource, null);
  assert.equal(effect.effectFilePath, "res:/recovery/effect.fx");
  assert.equal(effect.actualEffectFilePath, actual);

  effect.IsGood();
  assert.equal(effect.effectResource, resource);
  assert.deepEqual(values(effect, "effectResource"), before);
  effect.Destruct();
});

test("a pathless effect stays dropped, which is why every effect needs a path", t =>
{
  const run = harness(t);
  const effect = new Tr2Effect();
  effect.effectResource = prepared(new Tr2EffectRes(), "res:/recovery/manual.fx");
  blue.resMan.notify.Add(effect, effect.effectResource, effect, "effectResource");

  run.stopPastExpiry();
  assert.equal(effect.IsGood(), false);
  assert.equal(effect.effectResource, null);
  effect.Destruct();
});

test("Tr2GrannyAnimation primary reloads its authored path and rebuilds the rig", t =>
{
  const run = harness(t, () =>
  {
    const resource = new TriGrannyRes();
    resource._grannyFile = grannyFile();
    return resource;
  });
  const resource = run.manager.GetResource(PATH);

  const animation = new Tr2GrannyAnimation();
  animation.resPath = PATH;
  assert.equal(animation.IsInitialized(), true);
  const before = values(animation, "grannyRes");

  run.stopPastExpiry();
  assert.equal(animation.grannyRes, null);
  assert.equal(animation.resPath, PATH);
  assert.equal(animation.IsInitialized(), false);

  animation.Update(0.1);
  assert.equal(animation.grannyRes, resource);
  assert.equal(animation.IsInitialized(), true);
  assert.deepEqual(values(animation, "grannyRes"), before);
  animation.Destruct();
});

test("Tr2GrannyAnimation reloads an attached rig and clip through resMan", t =>
{
  const run = harness(t, () =>
  {
    const resource = new TriGrannyRes();
    resource._grannyFile = grannyFile();
    return resource;
  });
  const rig = run.manager.GetResource(PATH);
  const clip = run.manager.GetResource(CLIP);
  run.acquired.length = 0;

  const animation = new Tr2GrannyAnimation();
  animation.SetGrannyResource(rig);
  animation.SetSecondaryGrannyResource(CLIP, clip);
  assert.equal(animation.resPath, "", "an attachment is not a value");

  run.stopPastExpiry();
  assert.equal(animation.grannyRes, null);
  assert.equal(animation._secondaryResources.has(CLIP), true, "the clip path stays");
  assert.equal(animation._secondaryResources.get(CLIP), null);
  assert.equal(animation.GetAnimationNames().length, 0, "a null slot is tolerated");
  assert.equal(animation.GetSecondaryAnimationName(CLIP, 0), "");

  animation.Update(0.1);
  assert.deepEqual(run.acquired, [ PATH, CLIP ]);
  assert.deepEqual(run.requests.slice(-2), [ [ PATH, "" ], [ CLIP, "" ] ], "the same ordinary handles Graphene holds");
  assert.equal(animation.grannyRes, rig);
  assert.equal(animation._secondaryResources.get(CLIP), clip);
  assert.equal(animation.IsInitialized(), true);
  assert.equal(animation.resPath, "", "recovery does not write a value");
  animation.Destruct();
});

test("a secondary expiring alone rebuilds the primary's rig when it returns", t =>
{
  const run = harness(t, () =>
  {
    const resource = new TriGrannyRes();
    resource._grannyFile = grannyFile();
    return resource;
  });
  const rig = run.manager.GetResource(PATH);
  const clip = run.manager.GetResource(CLIP);
  const animation = new Tr2GrannyAnimation();
  animation.SetGrannyResource(rig);
  animation.SetSecondaryGrannyResource(CLIP, clip);

  run.manager.notify.Clear(clip);
  assert.equal(animation.grannyRes, rig);
  assert.equal(animation.IsInitialized(), false, "Carbon's ReleaseCachedData runs Cleanup for any resource");

  animation.Update(0.1);
  assert.equal(animation._secondaryResources.get(CLIP), clip);
  assert.equal(animation.IsInitialized(), true);
  animation.Destruct();
});

test("a raw attachment reloads raw, keeping its factory suffix across expiry", t =>
{
  const run = harness(t, () =>
  {
    const resource = new TriGrannyRes();
    resource._grannyFile = grannyFile();
    return resource;
  });
  const rig = prepared(new TriGrannyRes(), PATH, "raw");
  rig._grannyFile = grannyFile();
  run.handles.set(PATH, rig);

  const animation = new Tr2GrannyAnimation();
  animation.SetGrannyResource(rig);
  run.stopPastExpiry();
  animation.Update(0.1);

  assert.deepEqual(run.requests, [ [ PATH, "raw" ] ]);
  assert.equal(animation.grannyRes, rig);
  animation.Destruct();
});

test("AddSecondaryResPath reloads a null slot and leaves a live one", t =>
{
  const run = harness(t);
  const animation = new Tr2GrannyAnimation();

  assert.equal(animation.AddSecondaryResPath(CLIP), true);
  assert.deepEqual(run.requests, [ [ CLIP, "raw" ] ], "Tr2GrannyAnimation.cpp:354");
  const clip = animation._secondaryResources.get(CLIP);
  assert.equal(animation.AddSecondaryResPath(CLIP), false, "a live slot is not reloaded");

  run.stopPastExpiry();
  assert.equal(animation._secondaryResources.get(CLIP), null);
  assert.equal(animation.AddSecondaryResPath(CLIP), true);
  assert.equal(animation._secondaryResources.get(CLIP), clip);
  animation.Destruct();
});

test("Initialize asks resMan for the raw resource, and the rig builds when it arrives", t =>
{
  const run = harness(t, () => new TriGrannyRes());
  const pending = new TriGrannyRes();
  pending._path = PATH;
  run.handles.set(PATH, pending);

  const animation = new Tr2GrannyAnimation();
  animation.resPath = PATH;
  assert.deepEqual(run.requests, [ [ PATH, "raw" ] ], "Tr2GrannyAnimation.cpp:333");
  assert.equal(animation.grannyRes, pending);
  assert.equal(animation.IsInitialized(), false, "nothing to build from yet");
  assert.equal(run.manager.notify.GetByOwner(animation).length, 1);

  pending._grannyFile = grannyFile();
  pending._SetPrepared(true);
  pending._SetGood(true);
  pending._NotifyRebuildCachedData();
  assert.equal(animation.IsInitialized(), true, "the notification builds the rig");

  animation.resPath = "";
  assert.equal(animation.grannyRes, null);
  animation.Update(0.1);
  assert.equal(run.acquired.length, 1, "an emptied path does not reload");
  animation.Destruct();
});

test("an authored primary that expires reloads the same raw route", t =>
{
  const run = harness(t, () =>
  {
    const resource = new TriGrannyRes();
    resource._grannyFile = grannyFile();
    return resource;
  });
  const animation = new Tr2GrannyAnimation();
  animation.resPath = PATH;
  const resource = animation.grannyRes;
  const before = values(animation, "grannyRes");

  run.stopPastExpiry();
  assert.equal(animation.grannyRes, null);
  assert.equal(animation.resPath, PATH);

  animation.Update(0.1);
  assert.deepEqual(run.requests, [ [ PATH, "raw" ], [ PATH, "raw" ] ]);
  assert.equal(animation.grannyRes, resource);
  assert.equal(animation.IsInitialized(), true);
  assert.deepEqual(values(animation, "grannyRes"), before);
  animation.Destruct();
});

test("shared geometry is left to its mesh, and Destruct stops every reload", t =>
{
  const run = harness(t);
  const geometry = prepared(new TriGeometryRes(), PATH);
  const shared = new Tr2GrannyAnimation();
  shared.SetSharedGeometryRes(geometry);
  run.stopPastExpiry();
  run.acquired.length = 0;
  shared.Update(0.1);
  assert.deepEqual(run.acquired, []);
  shared.Destruct();

  const destroyed = new Tr2GrannyAnimation();
  destroyed.SetSecondaryGrannyResource(CLIP, prepared(new TriGeometryRes(), CLIP));
  destroyed.Destruct();
  destroyed.Update(0.1);
  assert.deepEqual(run.acquired, []);
});
