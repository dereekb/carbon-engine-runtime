import test from "node:test";
import assert from "node:assert/strict";
import { Tr2FontMeasurer, Tr2Sprite2dTextObject } from "../../npm/dist/trinity/index.js";

test("text sprite destruction unregisters its measurer listener while preserving peers", t =>
{
  const measurer = new Tr2FontMeasurer();
  const sprite = new Tr2Sprite2dTextObject(), peer = new Tr2Sprite2dTextObject();
  const changed = t.mock.method(sprite, "FontMeasurerChanged");
  const peerChanged = t.mock.method(peer, "FontMeasurerChanged");
  sprite.SetFontMeasurer(measurer);
  peer.SetFontMeasurer(measurer);
  measurer.Reset();
  assert.equal(changed.mock.callCount(), 1);
  assert.equal(peerChanged.mock.callCount(), 1);
  sprite.Destruct();
  sprite.Destruct();
  assert.equal(sprite.GetFontMeasurer(), null);
  assert.equal(measurer._changeListeners.has(sprite), false);
  assert.equal(measurer._changeListeners.has(peer), true);
  measurer.Reset();
  assert.equal(changed.mock.callCount(), 1);
  assert.equal(peerChanged.mock.callCount(), 2);
  peer.Destruct();
  assert.equal(measurer._changeListeners.size, 0);
  measurer.Destruct();
});
