import assert from "node:assert/strict";
import test from "node:test";
import { TriDevice, EveSpaceScene } from "../../npm/dist/trinity/index.js";

test("device destruction clears its scene reference without tearing the scene down", t =>
{
  // TriDevice.cpp:224-228: m_scene = NULL; the scene itself survives.
  const device = new TriDevice(), scene = new EveSpaceScene();
  const sceneTeardown = t.mock.method(scene, "Destruct");
  device.scene = scene;
  for (let repeat = 0; repeat < 2; repeat++)
  {
    device.Destruct();
    assert.equal(device.scene, null);
  }
  assert.equal(sceneTeardown.mock.callCount(), 0);
});
