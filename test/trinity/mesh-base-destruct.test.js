import assert from "node:assert/strict";
import test from "node:test";
import { Tr2Mesh, Tr2MeshBase, Tr2MeshArea } from "../../npm/dist/trinity/index.js";

test("public mesh teardown removes repeated area ownership while retaining peer ownership and list contents", () =>
{
  const mesh = new Tr2Mesh(), peer = new Tr2Mesh(), area = new Tr2MeshArea();
  mesh.opaqueAreas.Append(area);
  mesh.opaqueAreas.Append(area);
  mesh.decalAreas.Append(area);
  peer.opaqueAreas.Append(area);
  assert.equal(area.GetOwnerMeshes().filter(value => value === mesh).length, 3);
  const raw = new Tr2MeshArea();
  Array.prototype.push.call(mesh.flareAreas, raw);
  mesh.Destruct();
  mesh.Destruct();
  assert.deepEqual(area.GetOwnerMeshes(), [peer]);
  assert.deepEqual(raw.GetOwnerMeshes(), []);
  assert.deepEqual(Array.from(mesh.opaqueAreas), [area, area]);
  assert.deepEqual(Array.from(mesh.decalAreas), [area]);
  assert.deepEqual(Array.from(mesh.flareAreas), [raw]);
  assert.throws(() => area.RemoveOwnerMesh(mesh), /does not own/);
  peer.Destruct();
  assert.deepEqual(area.GetOwnerMeshes(), []);
});

test("retained mesh area lists stop notifying their retired owner", t =>
{
  const mesh = new Tr2Mesh();
  const notifications = t.mock.method(mesh, "OnListModified", () => {});
  for (const property of Tr2MeshBase._observedAreaProperties) mesh[property].ReplaceItems([]);
  assert.equal(notifications.mock.callCount(), Tr2MeshBase._observedAreaProperties.length);
  mesh.Destruct();
  mesh.Destruct();
  for (const property of Tr2MeshBase._areaProperties)
  {
    const info = {};
    mesh[property].GetInfo(info);
    assert.equal(info.notify, null);
    mesh[property].ReplaceItems([]);
  }
  assert.equal(notifications.mock.callCount(), Tr2MeshBase._observedAreaProperties.length);
});
