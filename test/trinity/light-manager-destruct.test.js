import assert from "node:assert/strict";
import test from "node:test";
import { Tr2LightManager, Tr2VariableStore, Tr2RenderContext_GetMainThreadRenderContext, TriDevice } from "../../npm/dist/trinity/index.js";
import { Tr2ConstantBufferAL } from "../../npm/dist/trinityal/index.js";

test("LightManager public destruction resets globals and releases its owned constant-buffer share", () =>
{
  const context = Tr2RenderContext_GetMainThreadRenderContext();
  context.GetRenderContextAL().CreateDevice({ mode: { width: 64, height: 64 } });
  const owner = new Tr2LightManager()._InitializeDevice("");
  const store = Tr2VariableStore.globalStore();
  assert.equal(store.FindVariable("LightBuffer").GetValue(), owner._lightBuffer);
  assert.equal(store.FindVariable("LightIndexBuffer").GetValue(), owner._indexBuffer);
  assert.ok(TriDevice.GetResourcesRegistered().includes(owner));
  assert.equal(owner._perFrameData.IsValid(), true);
  const peer = new Tr2ConstantBufferAL({ copy: owner._perFrameData });
  const shared = peer._buffer;
  const lightBuffer = owner._lightBuffer;
  try
  {
    for (let repeat = 0; repeat < 2; repeat++)
    {
      owner.Destruct();
      const empty = store.FindVariable("LightBuffer").GetValue();
      assert.equal(empty, store.FindVariable("LightIndexBuffer").GetValue(), "native reset shares one empty buffer");
      assert.notEqual(empty, lightBuffer);
      assert.equal(empty.IsValid(), false);
      assert.equal(owner._perFrameData.IsValid(), false);
      assert.equal(shared.owners, 1);
      assert.equal(peer.IsValid(), true);
      assert.equal(owner._lightBuffer, lightBuffer, "no reference clearing policy");
      assert.equal(TriDevice.GetResourcesRegistered().includes(owner), false);
    }
  }
  finally { peer.Destroy(); }
  assert.equal(shared.owners, 0);
  assert.equal(shared.implementation.IsValid(), false);
});

test("LightManager singleton deletion delegates reset exactly once to public destruction", t =>
{
  const owner = Tr2LightManager.getOrCreateInstance("");
  const reset = t.mock.method(Tr2LightManager, "ResetVariableStore");
  Tr2LightManager.deleteInstance();
  Tr2LightManager.deleteInstance();
  assert.equal(reset.mock.callCount(), 1);
  assert.equal(Tr2LightManager.getInstance(), null);
  assert.equal(owner._perFrameData.IsValid(), false);
});
