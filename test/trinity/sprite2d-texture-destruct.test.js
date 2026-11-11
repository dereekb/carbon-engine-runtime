import test from "node:test";
import assert from "node:assert/strict";
import { Tr2AtlasTexture, Tr2Sprite2dTexture, Tr2Sprite2d } from "../../npm/dist/trinity/index.js";

test("sprite texture destruction detaches its atlas and outbound listeners without affecting peers", t =>
{
  const atlas = new Tr2AtlasTexture();
  const texture = new Tr2Sprite2dTexture(), peer = new Tr2Sprite2dTexture();
  const sprite = new Tr2Sprite2d(), peerSprite = new Tr2Sprite2d();
  texture.SetAtlasTexture(atlas);
  peer.SetAtlasTexture(atlas);
  sprite.texturePrimary = texture;
  peerSprite.texturePrimary = peer;
  const changed = t.mock.method(sprite, "Sprite2dTextureChanged", () => {});
  const peerChanged = t.mock.method(peerSprite, "Sprite2dTextureChanged", () => {});
  atlas._NotifyListenersOfChange();
  assert.equal(changed.mock.callCount(), 1);
  assert.equal(peerChanged.mock.callCount(), 1);
  texture.Destruct();
  texture.Destruct();
  assert.equal(texture.GetAtlasTexture(), null);
  assert.equal(texture._changeListeners.size, 0);
  assert.equal(atlas._changeListeners.has(texture), false);
  assert.equal(atlas._changeListeners.has(peer), true);
  atlas._NotifyListenersOfChange();
  texture._SetDirty();
  assert.equal(changed.mock.callCount(), 1);
  assert.equal(peerChanged.mock.callCount(), 2);
  assert.equal(peer.GetAtlasTexture(), atlas);
  sprite.Destruct();
  peerSprite.Destruct();
  peer.Destruct();
  assert.equal(atlas._changeListeners.size, 0);
});
