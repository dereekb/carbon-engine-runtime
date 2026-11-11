import assert from "node:assert/strict";
import test from "node:test";
import { blue, BlueResMan } from "../../npm/dist/blue/index.js";
import { Tr2GrannyPrimitiveSet, TriDevice, Tr2RenderContext } from "../../npm/dist/trinity/index.js";
import { Tr2BufferDescriptionAL } from "../../npm/dist/trinityal/Tr2BufferAL/Tr2BufferDescriptionAL.js";
import { Tr2GpuUsage, Tr2CpuUsage } from "../../npm/dist/global/consts/renderContext/index.js";

test("primitive teardown frees all three buffers and unregisters only its device owner", () =>
{
  const previous = blue.resMan;
  blue.resMan = new BlueResMan();
  const context = new Tr2RenderContext();
  context.GetRenderContextAL().CreateDevice();
  const primitive = new Tr2GrannyPrimitiveSet(), peer = new Tr2GrannyPrimitiveSet();
  try
  {
    const buffers = [primitive._vertexBuffer, primitive._triangleIndexBuffer, primitive._lineIndexBuffer];
    const description = Tr2BufferDescriptionAL.create__Stride(4, 4, Tr2GpuUsage.VERTEX_BUFFER, Tr2CpuUsage.WRITE);
    for (const buffer of buffers)
    {
      buffer.Create(description, null, context);
      assert.equal(buffer.IsValid(), true);
    }
    TriDevice.RegisterResource(primitive);
    TriDevice.RegisterResource(peer);
    assert.ok(TriDevice.GetResourcesRegistered().includes(primitive));
    primitive.Destruct();
    primitive.Destruct();
    for (const buffer of buffers) assert.equal(buffer.IsValid(), false);
    assert.equal(TriDevice.GetResourcesRegistered().includes(primitive), false);
    assert.equal(TriDevice.GetResourcesRegistered().includes(peer), true);
  }
  finally
  {
    primitive.Destruct();
    peer.Destruct();
    blue.resMan = previous;
  }
});
