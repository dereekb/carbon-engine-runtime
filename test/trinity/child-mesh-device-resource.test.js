import assert from "node:assert/strict";
import test from "node:test";
import { EveChildMesh, Tr2DeviceResource, Tr2Renderer, TriDevice } from "../../npm/dist/trinity/index.js";
import { TriStorageFlags } from "../../npm/dist/global/consts/graphics/index.js";

// EveChildMesh is a Tr2DeviceResource (EveChildMesh.h:58-74). Its two hooks only free and re-bake morphs
// (cpp:1839-1857), and morph baking is not ported, so today they hold nothing. The base is what this pins.

test("EveChildMesh takes the device-resource base; its hooks hold nothing until morph baking is ported", t =>
{
  const oldResources = TriDevice._resourcesRegistered, oldGenerations = TriDevice._registeredGenerations;
  TriDevice._resourcesRegistered = [];
  TriDevice._registeredGenerations = [];
  t.after(() => { TriDevice._resourcesRegistered = oldResources; TriDevice._registeredGenerations = oldGenerations; });
  t.mock.method(Tr2Renderer, "IsResourceCreationAllowed", () => true);

  const mesh = new EveChildMesh();
  assert.equal(mesh.KeepAlive, Tr2DeviceResource.prototype.KeepAlive);
  assert.equal(mesh.PrepareResources, Tr2DeviceResource.prototype.PrepareResources);
  assert.equal(TriDevice.GetResourcesRegistered().includes(mesh), false, "nothing is registered before a use");

  mesh.KeepAlive();
  assert.equal(TriDevice.GetResourcesRegistered().includes(mesh), true);
  assert.equal(mesh.PrepareResources(), true, "not baked, so there is nothing to bake again (cpp:1851-1854)");
  mesh.ReleaseResources(TriStorageFlags.TRISTORAGE_ALL);
  assert.equal(mesh.PrepareResources(), true);

  // Carbon re-bakes a mesh that was baked; the bake itself is still the unported obligation.
  mesh._isMorphsBaked = true;
  assert.throws(() => mesh._OnPrepareResources(), /BakeMorphs is not implemented/);
});
