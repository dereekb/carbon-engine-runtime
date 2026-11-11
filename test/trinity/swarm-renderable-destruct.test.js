import test from "node:test";
import assert from "node:assert/strict";
import { EveSwarm, EveSwarmRenderable, Tr2Mesh, EveSpaceObjectDecal } from "../../npm/dist/trinity/index.js";

test("swarm renderable destruction detaches native owner and mesh without cascading", t =>
{
  const owner = new EveSwarm(), mesh = new Tr2Mesh();
  const renderable = new EveSwarmRenderable(), peer = new EveSwarmRenderable();
  renderable.InitializeRenderable(owner, mesh);
  peer.InitializeRenderable(owner, mesh);
  const ownerDestruct = t.mock.method(owner, "Destruct");
  const meshDestruct = t.mock.method(mesh, "Destruct");
  const decal = new EveSpaceObjectDecal();
  renderable.decals.Append(decal);
  renderable.Destruct();
  renderable.Destruct();
  assert.equal(renderable.owner, null);
  assert.equal(renderable.mesh, null);
  assert.equal(ownerDestruct.mock.callCount(), 0);
  assert.equal(meshDestruct.mock.callCount(), 0);
  assert.equal(peer.owner, owner);
  assert.equal(peer.mesh, mesh);
  assert.deepEqual(Array.from(renderable.decals), [decal]);
  peer.Destruct();
});
