import assert from "node:assert/strict";
import test from "node:test";
import { Tr2InteriorScene } from "../../../npm/dist/character/index.js";
import { Tr2VariableStore, Tr2RenderTarget, Tr2RenderBatch } from "../../../npm/dist/trinity/index.js";

test("interior destruction empties all owned batches and detaches the four published shadows", () =>
{
  const scene = new Tr2InteriorScene();
  const store = Tr2VariableStore.globalStore();
  const targets = Array.from({ length: 4 }, () => new Tr2RenderTarget());
  const handles = targets.map((target, index) =>
  {
    scene.lightRenderTargets.Append(target);
    const handle = store.FindVariable(`SpotlightShadow${index}`);
    handle.SetValue(target);
    return handle;
  });
  const accumulators = [scene._primaryRenderBatches, scene._pickingBatches, scene._opaquePickingBatches];
  for (const accumulator of accumulators)
  {
    accumulator.batches.push(new Tr2RenderBatch());
    accumulator.gdprBatches.push(new Tr2RenderBatch());
  }
  const unrelated = store.FindVariable("LightPrePassMap"), peer = new Tr2RenderTarget();
  unrelated.SetValue(peer);
  try
  {
    scene.Destruct();
    scene.Destruct();
    for (let index = 0; index < handles.length; index++)
    {
      assert.equal(store.FindVariable(`SpotlightShadow${index}`), handles[index]);
      assert.equal(handles[index].GetValue(), null);
    }
    for (const accumulator of accumulators)
    {
      assert.equal(accumulator.batches.length, 0);
      assert.equal(accumulator.gdprBatches.length, 0);
    }
    assert.equal(unrelated.GetValue(), peer);
  }
  finally
  {
    unrelated.SetValue(null);
    peer.Destroy();
  }
});

test("retained interior lists stop notifying the retired scene", t =>
{
  const scene = new Tr2InteriorScene();
  const lists = [scene.dynamics, scene.lights, scene.cells];
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
