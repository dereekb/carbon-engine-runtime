import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { Tr2PrimitiveScene, Tr2Renderer, TriDevice, TriPoolAllocator,
  Tr2RenderContext_GetMainThreadRenderContext } from "../../npm/dist/trinity/index.js";
import { Tr2RenderContextALStub, Tr2TextureAL } from "../../npm/dist/trinityal/index.js";
import { assertOwnedConstantBufferDestruct } from "../support/ownedConstantBufferDestruct.js";

test("primitive scene destroys its owned arena, picker and constant buffer", {
  skip: typeof globalThis.gc !== "function" && "requires node --expose-gc"
}, async t =>
{
  const context = Tr2RenderContext_GetMainThreadRenderContext();
  const previous = context.GetRenderContextAL();
  const al = new Tr2RenderContextALStub();
  al.CreateDevice();
  context.SetRenderContextAL(al);
  t.after(() => context.SetRenderContextAL(previous));
  t.mock.method(Tr2Renderer, "IsResourceCreationAllowed", () => true);
  const scene = new Tr2PrimitiveScene();
  const picker = scene._pickBuffer, allocator = scene._allocator;
  t.after(() => scene.Destruct());
  assert.equal(picker.PrepareResources(), true);
  const textures = [picker._pickTarget, picker._depthBuffer];
  const copies = textures.map(texture => new Tr2TextureAL({ copy: texture }));
  t.after(() => copies.forEach(copy => copy.Destroy()));
  assert.ok(textures.every(texture => texture.IsValid()));
  assert.ok(TriDevice.GetResourcesRegistered().includes(scene));
  assert.ok(TriDevice.GetResourcesRegistered().includes(picker));
  allocator.RegisterStruct("FullChunk", [{ name: "values", size: 8192, encoding: TriPoolAllocator.Type.VECTOR }]);
  // Exactly one default chunk: frame-end Clear would keep this backing store.
  const storage = new WeakRef(allocator.Allocate("FullChunk").GetData().buffer);
  await setImmediate();
  globalThis.gc();
  assert.ok(storage.deref(), "live scene retains its arena storage");
  assertOwnedConstantBufferDestruct(scene, ["_vertexConstants"]);
  assert.ok(textures.every(texture => !texture.IsValid()));
  assert.ok(copies.every(texture => texture.IsValid()));
  assert.equal(TriDevice.GetResourcesRegistered().includes(scene), false);
  assert.equal(TriDevice.GetResourcesRegistered().includes(picker), false);
  for (let attempt = 0; attempt < 3; attempt++)
  {
    await setImmediate();
    globalThis.gc();
  }
  assert.equal(storage.deref(), undefined, "owned allocator is destroyed rather than rewound for another frame");
  assert.equal(allocator.Has("FullChunk"), true, "allocator object itself remains held");
});
