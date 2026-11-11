import assert from "node:assert/strict";
import test from "node:test";
import { addChild } from "../../npm/dist/blue/children.js";
import { EveSpaceScene, EveEffectRoot2, Tr2RenderBatch, TriTextureRes } from "../../npm/dist/trinity/index.js";

test("space-scene teardown clears owned batches, publications and component registry without retiring content", () =>
{
  const scene = new EveSpaceScene(), peer = new EveSpaceScene();
  const child = new EveEffectRoot2(), peerChild = new EveEffectRoot2();
  addChild(scene, "objects", child, { listNotify: scene });
  addChild(peer, "objects", peerChild, { listNotify: peer });
  const registry = scene.componentRegistry, peerRegistry = peer.componentRegistry;
  assert.ok(registry.registeredEntities.includes(child));
  const accumulators = [scene._pickingBatches, ...scene._secondaryBatches.values(),
    scene._secondaryAdditiveBatches, ...scene._shadowBatches];
  for (const accumulator of accumulators)
  {
    accumulator.batches.push(new Tr2RenderBatch());
    accumulator.gdprBatches.push(new Tr2RenderBatch());
  }
  peer._pickingBatches.batches.push(new Tr2RenderBatch());
  const handles = [scene._envMap1Handle, scene._envMap2Handle, scene._reflectionMapHandle, scene._reflectionMaskMapHandle];
  const resource = new TriTextureRes();
  for (const handle of handles) handle.SetValue(resource);
  scene.Destruct();
  scene.Destruct();
  for (const accumulator of accumulators)
  {
    assert.equal(accumulator.batches.length, 0);
    assert.equal(accumulator.gdprBatches.length, 0);
  }
  for (const handle of handles) assert.equal(handle.GetValue(), null);
  assert.equal(registry.registeredEntities.length, 0);
  assert.equal(scene.componentRegistry, null);
  assert.deepEqual(Array.from(scene.objects), [child]);
  assert.ok(peerRegistry.registeredEntities.includes(peerChild));
  assert.equal(peer._pickingBatches.batches.length, 1);
  peer.Destruct();
});

test("retained space-scene lists stop notifying their retired owner", t =>
{
  const scene = new EveSpaceScene();
  const lists = [scene.backgroundObjects, scene.planets, scene.objects, scene.uiObjects];
  const notifications = t.mock.method(scene, "OnListModified", () => {});
  for (const list of lists) list.ReplaceItems([]);
  assert.equal(notifications.mock.callCount(), lists.length);
  scene.Destruct();
  scene.Destruct();
  for (const list of lists)
  {
    const info = {};
    list.GetInfo(info);
    assert.equal(info.notify, null);
    list.ReplaceItems([]);
  }
  assert.equal(notifications.mock.callCount(), lists.length);
});
