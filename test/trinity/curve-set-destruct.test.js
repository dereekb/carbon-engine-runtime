import assert from "node:assert/strict";
import test from "node:test";
import { TriCurveSet } from "../../npm/dist/trinity/index.js";
import { BlueScriptCallback } from "../../npm/dist/blue/index.js";

test("CurveSet public destruction releases its callback copy without calling or clearing peers", () =>
{
  let calls = 0;
  const callback = new BlueScriptCallback(() => calls++);
  const owner = new TriCurveSet(), peer = new TriCurveSet();
  owner.StopAfterWithCallback(10, callback);
  peer.StopAfterWithCallback(10, callback);
  assert.equal(owner._callback.IsValid(), true);
  owner.Destruct();
  owner.Destruct();
  owner.Dispose();
  assert.equal(owner._callback.IsValid(), false);
  assert.equal(peer._callback.IsValid(), true);
  assert.equal(callback.IsValid(), true);
  assert.equal(calls, 0);
  peer.CallStopCallback();
  assert.equal(calls, 1);
});
