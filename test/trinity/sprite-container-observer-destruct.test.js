import assert from "node:assert/strict";
import test from "node:test";
import { Tr2Sprite2dContainer, Tr2Sprite2d } from "../../npm/dist/trinity/index.js";

test("sprite container public teardown detaches parents and observers without clearing content", t =>
{
  const owner = new Tr2Sprite2dContainer(), peer = new Tr2Sprite2dContainer();
  const child = new Tr2Sprite2d(), background = new Tr2Sprite2d(), peerChild = new Tr2Sprite2d();
  owner.children.Append(child);
  owner.background.Append(background);
  peer.children.Append(peerChild);
  assert.equal(child._parent, owner);
  const notify = t.mock.method(owner, "OnListModified");
  owner.Destruct();
  owner.Destruct();
  assert.equal(child._parent, null);
  assert.equal(background._parent, null);
  assert.equal(peerChild._parent, peer);
  assert.equal(owner.children[0], child);
  assert.equal(owner.background[0], background);
  for (const list of [owner.children, owner.background])
  {
    const info = {};
    list.GetInfo(info);
    assert.equal(info.notify, null);
    list.ReplaceItems([]);
  }
  assert.equal(notify.mock.callCount(), 0);
  const peerInfo = {};
  peer.children.GetInfo(peerInfo);
  assert.equal(peerInfo.notify, peer);
});

