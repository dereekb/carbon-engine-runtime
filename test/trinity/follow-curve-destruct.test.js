import assert from "node:assert/strict";
import test from "node:test";
import { Tr2FollowCurve, Tr2ObjectFollowCurveKey } from "../../npm/dist/trinity/index.js";

test("FollowCurve public destruction clears keys before detaching its observer", t =>
{
  const owner = new Tr2FollowCurve(), peer = new Tr2FollowCurve(), key = new Tr2ObjectFollowCurveKey();
  owner.keys.Append(key);
  peer.keys.Append(key);
  const keys = owner.keys;
  const notify = t.mock.method(owner, "OnListModified");
  owner.Destruct();
  assert.equal(notify.mock.callCount(), 1, "explicit native Clear notifies before implicit member detach");
  owner.Destruct();
  assert.equal(notify.mock.callCount(), 1);
  assert.equal(owner.keys, keys);
  assert.equal(keys.length, 0);
  const info = {};
  keys.GetInfo(info);
  assert.equal(info.notify, null);
  keys.Append(key);
  assert.equal(notify.mock.callCount(), 1);
  assert.equal(peer.keys[0], key);
  const peerInfo = {};
  peer.keys.GetInfo(peerInfo);
  assert.equal(peerInfo.notify, peer);
});
