import assert from "node:assert/strict";
import test from "node:test";
import { Tr2Sprite2dLineTrace, Tr2Sprite2dTexture } from "../../npm/dist/trinity/index.js";
import { assertListObserverDestruct } from "../support/listObserverDestruct.js";

test("Tr2Sprite2dLineTrace public teardown detaches retained list observers", t =>
{
  const owner = new Tr2Sprite2dLineTrace();
  assertListObserverDestruct(t, owner, ["vertices"], owner.Destruct.bind(owner));
});

test("Tr2Sprite2dLineTrace public teardown also detaches inherited texture listeners", t =>
{
  const owner = new Tr2Sprite2dLineTrace(), peer = new Tr2Sprite2dLineTrace(), texture = new Tr2Sprite2dTexture();
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

test("Tr2Sprite2dLineTrace public teardown clears only its prepared geometry", () =>
{
  const owner = new Tr2Sprite2dLineTrace(), peer = new Tr2Sprite2dLineTrace();
  for (const sprite of [owner, peer])
  {
    sprite._renderVertices = [1, 2, 3];
    sprite._renderIndices.push(0, 1, 2);
    sprite._drawCalls.push({ vertexOffset: 0, vertexCount: 3 });
    sprite._textureOffsetAccum = 7;
  }
  owner.Destruct();
  owner.Destruct();
  assert.deepEqual(owner._renderVertices, []);
  assert.deepEqual(owner._renderIndices, []);
  assert.deepEqual(owner._drawCalls, []);
  assert.equal(owner._textureOffsetAccum, 0);
  assert.deepEqual(peer._renderVertices, [1, 2, 3]);
  assert.deepEqual(peer._renderIndices, [0, 1, 2]);
});
