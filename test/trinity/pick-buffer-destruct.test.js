import assert from "node:assert/strict";
import test from "node:test";
import { Tr2PickBuffer, Tr2Renderer, TriDevice, Tr2RenderContext_GetMainThreadRenderContext } from "../../npm/dist/trinity/index.js";
import { Tr2TextureAL, Tr2RenderContextALStub } from "../../npm/dist/trinityal/index.js";
import { PixelFormat } from "../../npm/dist/global/consts/renderContext/index.js";

test("picker destruction after resize releases only its attachment shares and registration", t =>
{
  const context = Tr2RenderContext_GetMainThreadRenderContext(), previous = context.GetRenderContextAL();
  const al = new Tr2RenderContextALStub();
  al.CreateDevice();
  context.SetRenderContextAL(al);
  t.after(() => context.SetRenderContextAL(previous));
  t.mock.method(Tr2Renderer, "IsResourceCreationAllowed", () => true);
  const picker = new Tr2PickBuffer(PixelFormat.PIXEL_FORMAT_R32G32B32A32_FLOAT, 1);
  t.after(() => picker.Destruct());
  assert.equal(picker.PrepareResources(), true);
  const holders = [picker._pickTarget, picker._depthBuffer];
  const oldCopies = holders.map(texture => new Tr2TextureAL({ copy: texture }));
  t.after(() => oldCopies.forEach(texture => texture.Destroy()));
  picker.SetSize(2);
  assert.ok(holders.every(texture => !texture.IsValid()));
  assert.ok(oldCopies.every(texture => texture.IsValid()));
  assert.equal(picker.PrepareResources(), true);
  const copies = holders.map(texture => new Tr2TextureAL({ copy: texture }));
  const implementations = copies.map(texture => texture.TrinityALImpl_GetObject());
  t.after(() => copies.forEach(texture => texture.Destroy()));
  assert.ok(TriDevice.GetResourcesRegistered().includes(picker));
  for (let repeat = 0; repeat < 2; repeat++)
  {
    picker.Destruct();
    assert.equal(TriDevice.GetResourcesRegistered().includes(picker), false);
    assert.ok(holders.every(texture => !texture.IsValid()));
    assert.ok(copies.every(texture => texture.IsValid()));
    assert.ok(oldCopies.every(texture => texture.IsValid()));
  }
  copies.forEach(texture => texture.Destroy());
  assert.ok(implementations.every(texture => !texture.IsValid()));
});
