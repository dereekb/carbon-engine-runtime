import assert from "node:assert/strict";
import test from "node:test";
import { Tr2GrannyAnimation } from "../../npm/dist/trinity/core/animation/Tr2GrannyAnimation.js";

test("animation teardown clears sampling state even without a resource while retaining authored layers", () =>
{
  const animation = new Tr2GrannyAnimation();
  animation.AddAnimationLayer("upper", 0.5);
  const base = animation.GetAnimationLayer(null), upper = animation.GetAnimationLayer("upper");
  base.queue.push({});
  upper.queue.push({});
  base.boneMask = upper.boneMask = {};
  animation._runtimeModel = {};
  animation._initialized = true;
  animation._meshBoneIndices.push(3);
  animation._meshBonePalette = {};
  animation._boneBounds.push({});
  animation._sampledPose = {};
  animation._poseModifierView = {};
  animation._morphAnimations.set("test", 1);
  const layers = animation._layers;
  animation.Destruct();
  animation.Destruct();
  assert.equal(base.queue.length, 0);
  assert.equal(upper.queue.length, 0);
  assert.equal(base.boneMask, null);
  assert.equal(upper.boneMask, null);
  assert.equal(animation._runtimeModel, null);
  assert.equal(animation._initialized, false);
  assert.equal(animation._meshBoneIndices.length, 0);
  assert.equal(animation._meshBonePalette, null);
  assert.equal(animation._boneBounds.length, 0);
  assert.equal(animation._sampledPose, null);
  assert.equal(animation._poseModifierView, null);
  assert.equal(animation._morphAnimations.size, 0);
  assert.equal(animation._layers, layers);
  assert.equal(animation.GetAnimationLayer("upper"), upper);
  assert.equal(upper.GetLayerWeight(), 0.5);
});
