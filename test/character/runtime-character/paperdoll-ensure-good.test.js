// CjsPaperDoll.IsGood keeps a hidden character's owned resources through resMan's idle purge.
import assert from "node:assert/strict";
import { test } from "node:test";
import { BlueResMan, blue } from "../../../npm/dist/blue/index.js";
import { CjsPaperDoll } from "../../../npm/dist/character/application/CjsPaperDoll.js";
import { CjsPaperDollCompositor } from "../../../npm/dist/character/application/compositor/CjsPaperDollCompositor.js";
import { Tr2SkinnedModel } from "../../../npm/dist/character/trinity/trinityCore/Tr2SkinnedModel.js";
import { TriGeometryRes } from "../../../npm/dist/resource/index.js";
import { RegisterDataLoader } from "../../support/testDataRes.js";
import "../../support/frameLoop.js";

/** One process-wide manager, restored after every test. */
function managerFor(t)
{
  const previous = blue.resMan;
  const manager = new BlueResMan({ source: { Read: () => "{}" } });
  blue.resMan = manager;
  RegisterDataLoader(manager, "json", value => JSON.parse(value));
  t.after(() => { try { manager.Clear(); } finally { blue.resMan = previous; } });
  return manager;
}

/**
 * A doll owning a compositor whose one effect draws from `texture`, a skeleton and one clip.
 * @returns {Promise<{ doll: CjsPaperDoll, owned: object[] }>}
 */
async function hiddenDoll(manager, name)
{
  const [ texture, skeleton, clip ] = [ "texture", "skeleton", "clip" ].map(kind => manager.GetResource(`res:/${name}/${kind}.json`));
  await Promise.all([ texture, skeleton, clip ].map(resource => manager.Ready(resource)));
  const compositor = new CjsPaperDollCompositor(null, null);
  // Stands in for a Tr2Effect: its IsGood renews the texture it draws from.
  compositor.effects.push({ IsGood: () => texture.IsGood() });
  const doll = new CjsPaperDoll();
  doll.compositors = [ compositor ];
  doll.skeletonResource = skeleton;
  doll.animationResources = new Map([ [ clip.GetPath(), clip ] ]);
  return { doll, owned: [ texture, skeleton, clip ] };
}

test("a hidden doll kept warm with IsGood keeps its resources through the idle purge; one left alone expires", async t =>
{
  const manager = managerFor(t);
  const warm = await hiddenDoll(manager, "warm"), cold = await hiddenDoll(manager, "cold");
  manager.activityTime = 1000;
  for (const resource of [ ...warm.owned, ...cold.owned ]) resource.IsGood();

  // Whoever hid the warm doll renews it well inside the idle limit; nothing asks for the cold one.
  for (const time of [ 11000, 21000, 31000, 41000 ])
  {
    manager.activityTime = time;
    assert.equal(warm.doll.IsGood(), true);
  }
  manager.PurgeInactive({ maxIdleMilliseconds: 30000, time: 45000 });

  for (const resource of warm.owned) assert.equal(manager.GetResourceStatus(resource).purged, false, resource.GetPath());
  for (const resource of cold.owned) assert.equal(manager.GetResourceStatus(resource).purged, true, resource.GetPath());
  assert.equal(cold.doll.compositors[0].IsGood(), false, "a purged input revives on use and is not good yet");
});

test("a destructed doll renews nothing it owned", async t =>
{
  const manager = managerFor(t), { doll, owned } = await hiddenDoll(manager, "gone");
  doll.Destruct();
  manager.activityTime = 1000;
  for (const resource of owned) resource.IsGood();
  manager.activityTime = 40000;
  assert.equal(doll.IsGood(), true, "nothing left to ask");
  manager.PurgeInactive({ maxIdleMilliseconds: 30000, time: 45000 });
  for (const resource of owned) assert.equal(manager.GetResourceStatus(resource).purged, true, resource.GetPath());
});


test("a bad character dependency never skips later renewals or the geometry owner link", () =>
{
  const calls = [], doll = new CjsPaperDoll(), compositor = new CjsPaperDollCompositor(null, null);
  const dependency = (name, good) => ({ IsGood(owner) { calls.push([name, owner]); return good; } });
  compositor.effects.push(dependency("effect1", false), dependency("effect2", true));
  doll.compositors = [compositor];
  doll.skeletonResource = dependency("skeleton", false);
  doll.animationResources = new Map([["a", dependency("clip", true)]]);
  const model = { geometryRes: dependency("model", false), GetMeshes() { return [{
    GetGeometryResource() { return dependency("mesh", false); },
    GetAllAreas() { return [{ GetMaterialInterface() { return dependency("material", true); } }]; }
  }]; } };
  doll.front = { objects: [{ visualModel: model }] };
  assert.equal(doll.IsGood(), false);
  assert.deepEqual(calls.map(([name]) => name), ["effect1", "effect2", "skeleton", "clip", "model", "mesh", "material"]);
  assert.equal(calls.find(([name]) => name === "model")[1], model);
  calls.length = 0;
  assert.equal(doll.IsGood(), false, "repeated readiness preserves the same traversal");
  assert.equal(calls.length, 7);
});

test("hidden doll renewal updates the real skinned-model owner lease", t =>
{
  const manager = managerFor(t), model = new Tr2SkinnedModel(), geometry = new TriGeometryRes();
  t.after(() => model.Destruct());
  model.geometryRes = geometry;
  // A plain member, so the test makes the link Initialize would.
  manager.notify.Add(model, geometry, model, "geometryRes");
  const doll = new CjsPaperDoll();
  doll.front = { objects: [{ visualModel: model }] };
  manager.activityTime = 12345;
  assert.equal(doll.IsGood(), false, "pending geometry is still not ready");
  assert.equal(manager.notify.GetByOwner(model)[0].lastUsed, 12345);
});
