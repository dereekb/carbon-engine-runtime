import assert from "node:assert/strict";
import test from "node:test";
import { Tr2ObjectFollowCurveKey, EveTransform, Locator } from "../../npm/dist/trinity/index.js";

test("ObjectFollow key public destruction clears native object and borrowed locator references", () =>
{
  const owner = new Tr2ObjectFollowCurveKey(), peer = new Tr2ObjectFollowCurveKey();
  const object = new EveTransform(), locator = new Locator();
  owner.object = peer.object = object;
  owner._locator = peer._locator = locator;
  owner.Destruct();
  owner.Destruct();
  assert.equal(owner.object, null);
  assert.equal(owner._locator, null);
  assert.equal(peer.object, object);
  assert.equal(peer._locator, locator);
});
