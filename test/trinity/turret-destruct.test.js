import assert from "node:assert/strict";
import test from "node:test";
import { blue, BlueResMan } from "../../npm/dist/blue/index.js";
import { EveTurretSet, EveTurretFiringFX, EveComponentRegistry, Tr2GrannyAnimation, Tr2RenderContext } from "../../npm/dist/trinity/index.js";
import { Tr2SuballocatedBuffer } from "../../npm/dist/trinity/core/device/Tr2SuballocatedBuffer/Tr2SuballocatedBuffer.js";
import { TriGeometryRes } from "../../npm/dist/trinity/resources/geometry/TriGeometryRes.js";
import { Tr2GpuUsage } from "../../npm/dist/global/consts/renderContext/index.js";

test("turret teardown stops firing, detaches animation and registry, and frees only its instance allocation", () =>
{
  const previous = blue.resMan, manager = new BlueResMan();
  blue.resMan = manager;
  const registry = new EveComponentRegistry(), context = new Tr2RenderContext();
  context.GetRenderContextAL().CreateDevice();
  const buffer = new Tr2SuballocatedBuffer("turret destructor", Tr2GpuUsage.VERTEX_BUFFER, 64, 128);
  try
  {
    const owner = new EveTurretSet(), peer = new EveTurretSet();
    const firing = new EveTurretFiringFX(), geometry = new TriGeometryRes();
    const sequencer = new Tr2GrannyAnimation();
    sequencer.SetSharedGeometryRes(geometry);
    owner.firingEffect = firing;
    firing.isFiring = true;
    owner.Register(registry);
    peer.Register(registry);
    assert.ok(registry.registeredEntities.includes(firing));
    owner.geometryResource = geometry;
    manager.notify.Add(owner, geometry, owner, "geometryResource");
    const allocation = buffer.Allocate(16, 1, null, context);
    const peerAllocation = buffer.Allocate(16, 1, null, context);
    owner._instanceBuffer = allocation;
    owner._turretVertexDeclElementCount = 4;
    owner._systemBoneID.fill(3);
    const turret = { sequencer, pose: {}, worldTransforms: [{}] };
    owner._turrets.push(turret);
    owner._animationControls.set(turret, {});
    owner.OnDestruct();
    owner.OnDestruct();
    assert.equal(firing.isFiring, false);
    assert.deepEqual(registry.registeredEntities, [peer]);
    assert.equal(owner.GetComponentRegistry(), null);
    assert.equal(firing.GetComponentRegistry(), null);
    assert.equal(turret.sequencer, null);
    assert.equal(turret.pose, null);
    assert.equal(turret.worldTransforms.length, 0);
    assert.equal(owner._animationControls.has(turret), false);
    assert.equal(sequencer.grannyRes, null);
    assert.equal(owner._turretVertexDeclElementCount, 0);
    assert.ok(owner._systemBoneID.every(value => value === 0xffffffff));
    assert.equal(allocation.IsValid(), false);
    assert.equal(peerAllocation.IsValid(), true);
    assert.equal(owner.firingEffect, firing);
    assert.equal(owner.geometryResource, geometry);
    assert.deepEqual(manager.notify.GetByOwner(owner), []);
    assert.deepEqual(manager.notify.GetByOwner(sequencer), []);
  }
  finally
  {
    registry.Clear();
    buffer.ReleaseResources();
    blue.resMan = previous;
  }
});
