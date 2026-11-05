import test from "node:test";
import assert from "node:assert/strict";
import { blue, BlueResMan } from "../../npm/dist/blue/index.js";
import { TriGeometryRes } from "../../npm/dist/trinity/resources/geometry/TriGeometryRes.js";
import { Tr2Mesh } from "../../npm/dist/trinity/core/mesh/Tr2Mesh.js";
import { EveSpaceObject2 } from "../../npm/dist/trinity/eve/spaceObject/EveSpaceObject2.js";
import { EveUpdateContext } from "../../npm/dist/trinity/eve/EveUpdateContext.js";

/** A synthetic decoded rig with one mesh-bound bone; no GPU or game data. */
function geometryFixture()
{
  const resource = new TriGeometryRes();
  resource._path = "res:/test/ship.gr2";
  resource._useCMF = false;
  resource._grannyFile = {
    models: [{ name: "Ship", meshBindings: [0], skeleton: { bones: [{
      name: "Root", parentIndex: -1, position: [1, 2, 3],
      orientation: [0, 0, 0, 1], scaleShear: [1, 0, 0, 0, 1, 0, 0, 0, 1]
    }] } }],
    meshes: [{ boneBindings: [{ name: "Root" }] }], animations: []
  };
  resource._grannySharedInfo = resource._grannyFile;
  resource._SetPrepared(true);
  resource._SetGood(true);
  return resource;
}

for (const scope of ["mesh and animation", "animation only"])
{
  test(`ship restores an expired ${scope} binding to the same cached geometry`, async t =>
  {
    const previousManager = blue.resMan;
    const manager = blue.resMan = new BlueResMan();
    const mesh = new Tr2Mesh();
    const ship = new EveSpaceObject2();
    t.after(() => {
      ship.animationUpdater.Destruct();
      mesh.Destruct();
      manager.Clear();
      blue.resMan = previousManager;
    });
    const geometry = geometryFixture();
    manager.motherLode.Insert(geometry.GetPath(), geometry);
    manager.activityTime = 1000;
    mesh.geometryResPath = geometry.GetPath();
    mesh.InitializeGeometryResource();
    ship.SetMesh(mesh);
    ship.update = true;
    const updater = ship.animationUpdater;
    assert.equal(updater.IsInitialized(), true);
    assert.equal(updater.GetMeshBoneCount(), 1);
    const expectedPalette = Array.from(updater.GetMeshBoneMatrixList());
    await Promise.resolve();
    assert.equal(mesh._loadFenceResource, null);

    // Advance the unchanged 30-second lease. Keep the cached resource so
    // reacquisition must restore ownership of the same handle, not a new one.
    manager.activityTime = 32001;
    if (scope === "animation only") geometry.IsGood(mesh);
    manager._PurgeNotifyTargets(manager.activityTime);
    assert.equal(updater.GetSharedGeometryRes(), null);
    assert.equal(updater.IsInitialized(), false);
    assert.equal(updater._meshBonePalette, null);
    assert.equal(ship._geometryResFromMesh, geometry);
    assert.equal(mesh.geometry, scope === "animation only" ? geometry : null);
    assert.equal(geometry.IsPrepared(), true);
    assert.equal(geometry._isPurged, false);

    ship.UpdateSyncronous(new EveUpdateContext());
    await Promise.resolve();
    assert.equal(mesh.geometry, geometry, "real mesh acquisition uses the cached handle");
    assert.equal(mesh._loadFenceResource, null, "real Ready fence settles");
    assert.equal(updater.GetSharedGeometryRes(), geometry);
    assert.equal(updater.IsInitialized(), true);
    assert.equal(updater.GetMeshBoneCount(), 1);
    assert.deepEqual(Array.from(updater.GetMeshBoneMatrixList()), expectedPalette);
    assert.equal(manager.GetNotifyTargetsByOwner(updater).filter(link => link.resource === geometry).length, 1);

    // Steady frames preserve the rig and palette rather than rebuilding them.
    const model = updater._runtimeModel;
    const palette = updater.GetMeshBoneMatrixList();
    for (let i = 0; i < 3; i++) ship.UpdateSyncronous(new EveUpdateContext());
    assert.equal(updater._runtimeModel, model);
    assert.equal(updater.GetMeshBoneMatrixList(), palette);
  });
}
