import assert from "node:assert/strict";
import test from "node:test";
import { blue, BlueResMan } from "../../npm/dist/blue/index.js";
import { EveTrailsSet } from "../../npm/dist/trinity/eve/attachment/booster/EveTrailsSet.js";
import { Tr2RenderContext } from "../../npm/dist/trinity/core/index.js";
import { Tr2SuballocatedBuffer } from "../../npm/dist/trinity/core/device/Tr2SuballocatedBuffer/Tr2SuballocatedBuffer.js";
import { TriGeometryRes } from "../../npm/dist/trinity/resources/geometry/TriGeometryRes.js";
import { Tr2GpuUsage } from "../../npm/dist/global/consts/renderContext/index.js";

test("trails teardown frees its shared allocation while preserving peer storage and authored trails", () =>
{
  const previous = blue.resMan, manager = new BlueResMan();
  blue.resMan = manager;
  const context = new Tr2RenderContext();
  context.GetRenderContextAL().CreateDevice();
  const buffer = new Tr2SuballocatedBuffer("trails destructor", Tr2GpuUsage.VERTEX_BUFFER, 64, 128);
  try
  {
    const trails = new EveTrailsSet(), geometry = new TriGeometryRes();
    const allocation = buffer.Allocate(16, 1, null, context);
    const peer = buffer.Allocate(16, 1, null, context);
    trails._instanceBuffer = allocation;
    trails._trailVertexDeclElementCount = 4;
    trails.geometryResource = geometry;
    trails.trailData.push({ size: 1 });
    manager.notify.Add(trails, geometry, trails, "geometryResource");
    trails.Destruct();
    trails.Destruct();
    assert.equal(allocation.IsValid(), false);
    assert.equal(peer.IsValid(), true);
    assert.equal(buffer._allocators[0].GetAllocatedMemory(), 16);
    assert.equal(trails._instanceBuffer, null);
    assert.equal(trails._trailVertexDeclElementCount, 0);
    // EveTrailsSet.Destruct (e3f2aea3f, lines 408-414) already cleared this slot.
    assert.equal(trails.geometryResource, null);
    assert.equal(trails.trailData.length, 1);
    assert.deepEqual(manager.notify.GetByOwner(trails), []);
    const replacement = buffer.Allocate(16, 1, null, context);
    assert.equal(replacement.GetOffset(), allocation.GetOffset());
  }
  finally
  {
    buffer.ReleaseResources();
    blue.resMan = previous;
  }
});
