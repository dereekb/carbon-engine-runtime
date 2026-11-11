import assert from "node:assert/strict";
import test from "node:test";
import { Tr2RenderContext } from "../../npm/dist/trinity/index.js";
import { Tr2SuballocatedBuffer } from "../../npm/dist/trinity/core/device/Tr2SuballocatedBuffer/Tr2SuballocatedBuffer.js";
import { Tr2GpuUsage } from "../../npm/dist/global/consts/renderContext/index.js";

test("allocation public destruction returns its range once and preserves other allocations", () =>
{
  const context = new Tr2RenderContext();
  context.GetRenderContextAL().CreateDevice();
  const parent = new Tr2SuballocatedBuffer("destruct", Tr2GpuUsage.VERTEX_BUFFER, 128, 128);
  const owner = parent.Allocate(4, 4, null, context);
  const peer = parent.Allocate(4, 4, null, context);
  assert.ok(owner && peer);
  const offset = owner.GetOffset(), buffer = peer.GetBuffer();
  try
  {
    assert.equal(parent._allocators[0].GetAllocatedMemory(), 32);
    owner.Destruct();
    owner.Destruct();
    assert.equal(owner.IsValid(), false);
    assert.equal(parent._allocators[0].GetAllocatedMemory(), 16);
    assert.equal(peer.IsValid(), true);
    assert.equal(peer.GetBuffer(), buffer);
    const replacement = parent.Allocate(4, 4, null, context);
    assert.equal(replacement.GetOffset(), offset);
    replacement.Destruct();
    peer.Destruct();
    assert.equal(parent._allocators[0].GetAllocatedMemory(), 0);
  }
  finally { parent.Destruct(); }
});


