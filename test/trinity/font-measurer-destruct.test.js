import assert from "node:assert/strict";
import test from "node:test";
import { Tr2FontMeasurer, Tr2Sprite2dTextObject } from "../../npm/dist/trinity/index.js";

test("FontMeasurer public teardown resets text then releases listeners", t =>
{
  const owner = new Tr2FontMeasurer(), peer = new Tr2FontMeasurer(), target = new Tr2Sprite2dTextObject();
  const changed = t.mock.method(target, "FontMeasurerChanged");
  owner.RegisterForChangeNotification(target);
  peer.RegisterForChangeNotification(target);
  owner.cursorX = 17;
  owner.cursorY = 9;
  owner.ascender = 12;
  owner.descender = 3;
  owner._currentFace = 8;
  owner._renderData.push({ bitmaps: [] });
  owner._committedRenderData.push({ bitmaps: [] });
  owner._vertices = [1];
  owner._indices = [0];
  owner._drawCalls.push({ startSprite: 0 });
  owner.Destruct();
  assert.equal(changed.mock.callCount(), 1);
  owner.Destruct();
  assert.equal(changed.mock.callCount(), 1);
  assert.equal(owner.HasCommittedText(), false);
  assert.equal(owner.HasUncommittedText(), false);
  assert.deepEqual([owner.cursorX, owner.cursorY, owner.ascender, owner.descender, owner._currentFace], [0, 0, 0, 0, 0]);
  assert.equal(owner._vertices, null);
  assert.equal(owner._indices, null);
  assert.equal(owner._drawCalls.length, 0);
  assert.equal(owner._changeListeners.size, 0);
  peer.Reset();
  assert.equal(changed.mock.callCount(), 2);
});
