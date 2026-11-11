import assert from "node:assert/strict";
import test from "node:test";
import { Tr2Sprite2dPolygon, Tr2Sprite2dTexture } from "../../npm/dist/trinity/index.js";
import { assertListObserverDestruct } from "../support/listObserverDestruct.js";

test("Tr2Sprite2dPolygon public teardown detaches retained list observers", t =>
{
  const owner = new Tr2Sprite2dPolygon();
  assertListObserverDestruct(t, owner, ["vertices","triangles"], owner.Destruct.bind(owner));
});

test("Tr2Sprite2dPolygon public teardown also detaches inherited texture listeners", t =>
{
  const owner = new Tr2Sprite2dPolygon(), peer = new Tr2Sprite2dPolygon(), texture = new Tr2Sprite2dTexture();
  owner.texturePrimary = texture;
  peer.texturePrimary = texture;
  const changed = t.mock.method(owner, "Sprite2dTextureChanged", () => {});
  const peerChanged = t.mock.method(peer, "Sprite2dTextureChanged", () => {});
  texture._SetDirty();
  assert.equal(changed.mock.callCount(), 1);
  owner.Destruct();
  owner.Destruct();
  texture._SetDirty();
  assert.equal(changed.mock.callCount(), 1);
  assert.equal(peerChanged.mock.callCount(), 2);
});
