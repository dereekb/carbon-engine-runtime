import assert from "node:assert/strict";
import test from "node:test";
import { blue, BlueResMan } from "../../npm/dist/blue/index.js";
import { Tr2InteriorStatic } from "../../npm/dist/character/incarna/interior/Tr2InteriorStatic.js";
import { TriGeometryRes } from "../../npm/dist/trinity/resources/geometry/TriGeometryRes.js";

test("interior static teardown detaches the cell back pointer and only its own notify link", () =>
{
  const previous = blue.resMan, manager = new BlueResMan();
  blue.resMan = manager;
  try
  {
    const owner = new Tr2InteriorStatic(), peer = new Tr2InteriorStatic();
    const geometry = new TriGeometryRes(), cell = {};
    owner._parentCell = peer._parentCell = cell;
    owner.geometry = peer.geometry = geometry;
    manager.notify.Add(owner, geometry, owner, "geometry");
    manager.notify.Add(peer, geometry, peer, "geometry");
    owner.OnDestruct();
    owner.OnDestruct();
    assert.equal(owner._parentCell, null);
    assert.equal(peer._parentCell, cell);
    assert.equal(owner.geometry, geometry);
    assert.deepEqual(manager.notify.GetByOwner(owner), []);
    assert.equal(manager.notify.GetByOwner(peer).length, 1);
    peer.OnDestruct();
  }
  finally { blue.resMan = previous; }
});
