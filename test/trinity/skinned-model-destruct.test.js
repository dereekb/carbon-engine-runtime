import assert from "node:assert/strict";
import test from "node:test";
import { blue, BlueResMan } from "../../npm/dist/blue/index.js";
import { Tr2SkinnedModel } from "../../npm/dist/character/trinity/trinityCore/Tr2SkinnedModel.js";
import { TriGeometryRes } from "../../npm/dist/trinity/resources/geometry/TriGeometryRes.js";

for (const hasGeometry of [false, true])
{
  test(`skinned teardown releases selected skeleton with geometry=${hasGeometry}`, () =>
  {
    const previous = blue.resMan, manager = new BlueResMan();
    blue.resMan = manager;
    try
    {
      const model = new Tr2SkinnedModel();
      const geometry = hasGeometry ? new TriGeometryRes() : null;
      model.geometryRes = geometry;
      model._skeletonIx = 7;
      if (geometry) manager.notify.Add(model, geometry, model, "geometryRes");
      model.OnDestruct();
      model.OnDestruct();
      assert.equal(model._skeletonIx, 0xffffffff);
      assert.equal(model.geometryRes, geometry);
      assert.deepEqual(manager.notify.GetByOwner(model), []);
    }
    finally { blue.resMan = previous; }
  });
}
