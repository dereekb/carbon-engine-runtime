import assert from "node:assert/strict";
import test from "node:test";
import { Tr2FontManager } from "../../npm/dist/trinity/index.js";
import { blue } from "../../npm/dist/blue/index.js";
import { trinity } from "../../npm/dist/trinity/CjsTrinity.js";

test("FontManager public teardown stops its tick and clears only its cache", t =>
{
  const owner = Tr2FontManager.initialize(), peer = Tr2FontManager.initialize();
  const ticks = t.mock.method(owner, "OnTick", () => {});
  const peerTicks = t.mock.method(peer, "OnTick", () => {});
  const glyph = { sbit: {}, lastFrameUsed: 0, memoryUsage: 4 };
  owner._glyphs.set("test", glyph);
  owner.totalGlyphsCachedSize = 4;
  peer._glyphs.set("test", glyph);
  try
  {
    blue.os.PumpOS();
    assert.equal(ticks.mock.callCount(), 1);
    owner.Destruct();
    owner.Destruct();
    assert.equal(blue.os.IsRegisteredForTicks(owner), false);
    assert.equal(owner._glyphs.size, 0);
    assert.equal(owner.totalGlyphsCachedSize, 0);
    blue.os.PumpOS();
    assert.equal(ticks.mock.callCount(), 1);
    assert.equal(peerTicks.mock.callCount(), 2);
    assert.equal(peer._glyphs.get("test"), glyph);
  }
  finally { peer.Destruct(); }
});

test("FontManager shutdown retains its existing singleton caller and dispatches cleanup", () =>
{
  const previous = trinity.fontManager;
  const owner = Tr2FontManager.initialize();
  trinity.fontManager = owner;
  try
  {
    Tr2FontManager.shutdown();
    Tr2FontManager.shutdown();
    assert.equal(trinity.fontManager, null);
    assert.equal(blue.os.IsRegisteredForTicks(owner), false);
  }
  finally { trinity.fontManager = previous; }
});
