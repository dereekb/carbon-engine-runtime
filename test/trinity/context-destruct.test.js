import assert from "node:assert/strict";
import test from "node:test";
import { Tr2RenderContext, Tr2VariableStore } from "../../npm/dist/trinity/core/index.js";
import { Tr2BufferAL, Tr2BufferDescriptionAL } from "../../npm/dist/trinityal/index.js";
import { Tr2GpuUsage, Tr2CpuUsage } from "../../npm/dist/global/consts/renderContext/index.js";

test("context teardown retires state and blitter before the backend, preserving a borrowed buffer", t =>
{
  const context = new Tr2RenderContext(), al = context.GetRenderContextAL();
  al.CreateDevice();
  const buffer = al.CreateBuffer(Tr2BufferDescriptionAL.create__Stride(4, 16, Tr2GpuUsage.VERTEX_BUFFER, Tr2CpuUsage.WRITE));
  const peer = new Tr2BufferAL({ copy: buffer });
  const states = context.GetEffectStateManager();
  states.BeginManagedRendering();
  states.ApplyStreamSource(0, buffer, 0, 4);
  buffer.Destroy();
  context.GetBlitter();
  const destroy = al.Destroy;
  let backendCalls = 0;
  t.mock.method(al, "Destroy", function()
  {
    backendCalls++;
    assert.equal(states.GetCurrentValues().streams[0].vertexBuffer, null);
    assert.equal(Tr2VariableStore.globalStore().FindVariable("BlitSource"), null);
    return destroy.call(this);
  });
  context.Destruct();
  context.Destruct();
  assert.equal(backendCalls, 2, "preserve the existing repeat-call contract");
  assert.equal(peer.IsValid(), true);
  peer.Destroy();
});
