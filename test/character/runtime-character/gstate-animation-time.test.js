import assert from "node:assert/strict";
import { test } from "node:test";
import { Tr2GStateAnimation } from "../../../npm/dist/character/index.js";
import { TriDevice } from "../../../npm/dist/trinity/core/device/TriDevice.js";
import { trinity } from "../../../npm/dist/trinity/index.js";

/** Runs fn with trinity.device replaced by a bare device whose animation clock the test sets. */
function withClock(fn)
{
  const previous = trinity.device;
  const device = new TriDevice();
  trinity.device = device;
  try { fn(seconds => { device.animationTime = seconds; }); }
  finally { trinity.device = previous; }
}

test("Tr2GStateAnimation time: the renderer clock, pause held, scrub fixed then playing (Tr2GStateAnimation.cpp:1255-1375)", () =>
{
  withClock(setTime =>
  {
    const animation = new Tr2GStateAnimation();
    setTime(10);
    assert.equal(animation.GetAnimationTime(), 10);
    animation.TogglePauseAnimations(true);
    setTime(12);
    assert.equal(animation.GetAnimationTime(), 10, "paused");
    animation.TogglePauseAnimations(false);
    assert.equal(animation.GetAnimationTime(), 10, "resumes where it paused");

    animation.StartScrub();
    animation.SetScrubOffset(0.5);
    setTime(13);
    assert.equal(animation.GetAnimationTime(), 10.5, "scrub holds its position");
    assert.equal(animation.GetScrubOffset(), 0.5);
    animation.PlayFromScrub();
    setTime(14);
    // Quirk (cpp:1305): the play offset adds the 2 s pause offset that GetAnimationTime subtracts.
    assert.equal(animation.GetAnimationTime(), 14 - 2 + (10.5 - (13 + 2)), "playing scrub moves with the clock");
    animation.SetScrubOffset(9);
    animation.StopPlayFromScrub();
    assert.equal(animation.GetScrubOffset(), (14 - 2 + (10.5 - 15)) - 10, "stop keeps the played position; a set while playing is ignored");
    animation.ClearScrub();
    assert.equal(animation.GetScrubOffset(), 0);
    assert.equal(animation.GetAnimationTime(), 12);
  });
});

test("Tr2GStateAnimation: graph driving needs Granny's GState runtime; the graph's queries are portable and unported", () =>
{
  const animation = new Tr2GStateAnimation();
  assert.throws(() => animation.ForceChangeToState("Idle"), /needs Granny's proprietary GState runtime/);
  assert.throws(() => animation.PrePhysicsAnimation(0, null), /needs Granny's proprietary GState runtime/);
  assert.throws(() => animation.GetTopLevelNodeNames(), /is not implemented/);
  assert.deepEqual(animation.GetParameterRange("Params", "speed"), [], "Carbon quirk: always empty");
  assert.doesNotThrow(() => animation.PostPhysicsAnimation(0, null));
});
