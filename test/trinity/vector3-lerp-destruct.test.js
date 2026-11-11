import assert from "node:assert/strict";
import test from "node:test";
import { Tr2CurveVector3Lerp } from "../../npm/dist/trinity/index.js";

test("Vector3Lerp public destruction releases only its explicit child reference", () =>
{
  const owner = new Tr2CurveVector3Lerp(), peer = new Tr2CurveVector3Lerp(), child = new Tr2CurveVector3Lerp();
  owner.curve = peer.curve = child;
  child.initialValue.set([1, 2, 3]);
  owner.Destruct();
  owner.Destruct();
  assert.equal(owner.curve, null);
  assert.equal(peer.curve, child);
  assert.deepEqual(Array.from(child.initialValue), [1, 2, 3]);
});
