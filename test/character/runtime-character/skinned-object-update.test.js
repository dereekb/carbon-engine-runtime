import assert from "node:assert/strict";
import { test } from "node:test";
import { Tr2GrannyAnimation } from "../../../npm/dist/trinity/core/animation/Tr2GrannyAnimation.js";
import { TriDevice } from "../../../npm/dist/trinity/core/device/TriDevice.js";
import { trinity } from "../../../npm/dist/trinity/index.js";
import { Tr2IntSkinnedObject, Tr2InteriorPlaceable } from "../../../npm/dist/character/index.js";

const TICKS = 10000000;
const identity3 = [ 1, 0, 0, 0, 1, 0, 0, 0, 1 ];
const identity4 = [ 0, 0, 0, 1 ];

/** One root bone and a 2-second "Move" animation from x 0 to x 10. */
function createAnimation()
{
  const animation = new Tr2GrannyAnimation();
  animation.model_ = "Ship";
  animation.SetGrannyResource({
    models: [ { name: "Ship", skeleton: { bones: [ { name: "Root", parentIndex: -1, position: [ 0, 0, 0 ], orientation: identity4, scaleShear: identity3 } ] }, meshBindings: [ 0 ] } ],
    meshes: [ { boneBindings: [ { name: "Root" } ] } ],
    animations: [ { name: "Move", duration: 2, trackGroups: [ { name: "Ship", transformTracks: [ { name: "Root", position: { knots: [ 0, 2 ], controls: [ 0, 0, 0, 10, 0, 0 ], dimension: 3, degree: 1 } } ] } ] } ]
  });
  return animation;
}

/** The root bone's x after sampling. */
const rootX = animation => animation.GetAnimationTransforms()[0][12];

/** Runs fn with trinity.device replaced by a bare device whose animation clock the test sets. */
function withClock(fn)
{
  const previous = trinity.device;
  const device = new TriDevice();
  trinity.device = device;
  try { fn(seconds => { device.animationTime = seconds; }); }
  finally { trinity.device = previous; }
}

function close(actual, expected, message)
{
  assert.ok(Math.abs(actual - expected) < 1e-5, `${message}: ${actual} != ${expected}`);
}

test("PrePhysicsAnimation samples at the renderer's animation clock: no clamp, and controllers started apart stay apart by their start times (Tr2GrannyAnimation.cpp:1693-1760, 2004-2011)", () =>
{
  withClock(setTime =>
  {
    const a = createAnimation(), b = createAnimation();
    setTime(10);
    a.PrePhysicsAnimation(0, null);
    a.PlayAnimation("Move", true, 0, 0, 1, false);
    setTime(10.5);
    b.PrePhysicsAnimation(0, null);
    b.PlayAnimation("Move", true, 0, 0, 1, false);
    // Uneven frames, one of them 0.4 s (2.5 fps): each controller is at its elapsed clock time.
    for (const seconds of [ 10.6, 10.65, 11.05, 11.1, 11.5 ])
    {
      setTime(seconds);
      a.PrePhysicsAnimation(0, null);
      b.PrePhysicsAnimation(0, null);
      close(rootX(a), 5 * ((seconds - 10) % 2), `a at ${seconds}`);
      close(rootX(b), 5 * ((seconds - 10.5) % 2), `b at ${seconds}`);
    }
  });
});

test("A play between samples starts at its own time, not at the previous sample's (cmf players start when played)", () =>
{
  withClock(setTime =>
  {
    const animation = createAnimation();
    setTime(1);
    animation.PrePhysicsAnimation(0, null);
    setTime(1.25);
    animation.PlayAnimation("Move", true, 0, 0, 1, false);
    setTime(1.5);
    animation.PrePhysicsAnimation(0, null);
    close(rootX(animation), 5 * 0.25, "a quarter second since the play");
  });
});

test("TogglePauseAnimations holds the animation time and resumes without a jump (Tr2GrannyAnimation.cpp:2013-2031)", () =>
{
  withClock(setTime =>
  {
    const animation = createAnimation();
    setTime(0);
    animation.PrePhysicsAnimation(0, null);
    animation.PlayAnimation("Move", true, 0, 0, 1, false);
    setTime(0.5);
    animation.PrePhysicsAnimation(0, null);
    animation.TogglePauseAnimations(true);
    setTime(3);
    animation.PrePhysicsAnimation(0, null);
    close(rootX(animation), 2.5, "paused at 0.5 s");
    animation.TogglePauseAnimations(false);
    setTime(3.25);
    animation.PrePhysicsAnimation(0, null);
    close(rootX(animation), 5 * 0.75, "resumed: 0.5 s + 0.25 s");
  });
});

test("The hourly recentre of the device clock is crossed, not run backwards (TriDevice.cpp:823-826)", () =>
{
  withClock(setTime =>
  {
    const animation = createAnimation();
    setTime(TriDevice.ANIMATION_TIME_MAX - 0.25);
    animation.PrePhysicsAnimation(0, null);
    animation.PlayAnimation("Move", true, 0, 0, 1, false);
    setTime(0.25);
    animation.PrePhysicsAnimation(0, null);
    close(rootX(animation), 2.5, "half a second across the recentre");
  });
});

test("Update(dt) still advances by its delta for the space objects' updaters", () =>
{
  const animation = createAnimation();
  animation.PlayAnimation("Move", true, 0, 0, 1, false);
  animation.Update(0.5);
  close(rootX(animation), 2.5, "half a second");
});

/** A visual model with a skeleton, whose bones the test does not need. */
function skinned(calls)
{
  const object = new Tr2IntSkinnedObject();
  object.visualModel = { GetSkeleton: () => ({}) };
  object.UpdateBones = time => calls.push([ "bones", time ]);
  object.animationUpdater = {
    PrePhysicsAnimation: (time, transform) => calls.push([ "pre", time, transform === object.transform ]),
    PostPhysicsAnimation: (time, transform) => calls.push([ "post", time, transform === object.transform ])
  };
  object.worldTransformUpdater = { UpdateTransform: (time, transform) => calls.push([ "world", time, transform === object.transform ]) };
  object.curveSets.push({ Update: seconds => calls.push([ "curves", seconds ]) });
  return object;
}

test("Tr2SkinnedObject Pre/PostPhysicsUpdate run Carbon's order: animation pre; curve sets, animation post, bones, world-transform updater (Tr2SkinnedObject.cpp:60-128)", () =>
{
  const calls = [];
  const object = skinned(calls);
  object.PrePhysicsUpdate(3 * TICKS);
  object.PostPhysicsUpdate(3 * TICKS, null);
  assert.deepEqual(calls, [
    [ "pre", 3 * TICKS, true ],
    [ "curves", 3 ],
    [ "post", 3 * TICKS, true ],
    [ "bones", 3 * TICKS ],
    [ "world", 3 * TICKS, true ]
  ]);
});

test("updatePeriod skips both updates until it has passed since the last post update (Tr2SkinnedObject.cpp:64-68, 87-93)", () =>
{
  const calls = [];
  const object = skinned(calls);
  object.updatePeriod = 0.5;
  object.PrePhysicsUpdate(TICKS);
  object.PostPhysicsUpdate(TICKS, null);
  calls.length = 0;
  object.PrePhysicsUpdate(1.25 * TICKS);
  object.PostPhysicsUpdate(1.25 * TICKS, null);
  assert.deepEqual(calls, [], "a quarter second is inside the period");
  object.PrePhysicsUpdate(1.5 * TICKS);
  object.PostPhysicsUpdate(1.5 * TICKS, null);
  assert.equal(calls.filter(call => call[0] === "bones").length, 1, "half a second has passed");
});

test("Without a visual model only the curve sets update (Tr2SkinnedObject.cpp:95-104)", () =>
{
  const calls = [];
  const object = skinned(calls);
  object.visualModel = null;
  object.PrePhysicsUpdate(TICKS);
  object.PostPhysicsUpdate(TICKS, null);
  assert.deepEqual(calls, [ [ "curves", 1 ] ]);
});

test("Tr2IntSkinnedObject.PostPhysicsUpdate republishes the cell reflection maps and advances their blend (Tr2IntSkinnedObject.cpp:73-82)", () =>
{
  const object = new Tr2IntSkinnedObject();
  const a = { name: "a" }, b = { name: "b" };
  object._cellReflectionMaps = [ a, b ];
  object._previousUpdateTime = 2 * TICKS;
  object.PostPhysicsUpdate(2.5 * TICKS, null);
  assert.equal(object.variableStore.FindVariable("CellReflectionMap").GetValue(), a);
  assert.equal(object.variableStore.FindVariable("CellReflection2ndMap").GetValue(), b);
  close(object.variableStore.FindVariable("CellReflectionInterpolation").GetValue(), 0.5, "blend time");
  assert.equal(object._previousUpdateTime, 2.5 * TICKS);
});

test("Tr2InteriorPlaceable.PostPhysicsUpdate swaps its reflection pair once after a second (Tr2InteriorPlaceable.cpp:147-170)", () =>
{
  const placeable = new Tr2InteriorPlaceable();
  const a = { name: "a" }, b = { name: "b" };
  placeable._cellReflectionMaps = [ a, b ];
  placeable.PrePhysicsUpdate(0);
  placeable.PostPhysicsUpdate(0.5 * TICKS, null);
  assert.equal(placeable.variableStore.FindVariable("CellReflectionMap").GetValue(), a, "inside the first second");
  placeable.PostPhysicsUpdate(1.5 * TICKS, null);
  assert.equal(placeable.variableStore.FindVariable("CellReflectionMap").GetValue(), b, "swapped after a second");
  placeable.PostPhysicsUpdate(3 * TICKS, null);
  assert.equal(placeable.variableStore.FindVariable("CellReflectionMap").GetValue(), b, "only once");
});
