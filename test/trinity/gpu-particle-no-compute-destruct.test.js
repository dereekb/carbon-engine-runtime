import test from "node:test";
import { assertNoComputeTeardown } from "../support/noComputeDestruct.js";

test("no-compute helper releases its owned resources and preserves copied shares", t =>
{
  assertNoComputeTeardown(t, false);
});
import assert from "node:assert/strict";
import { Tr2GpuParticleSystem, Tr2Effect, TriTextureParameter, Tr2Vector4Parameter } from "../../npm/dist/trinity/index.js";
import { Tr2GpuParticleSystemNoCompute } from "../../npm/dist/trinity/particle/Tr2GpuParticleSystemNoCompute.js";

test("fallback effect teardown preserves shared authored material associations and values", t =>
{
  const initialize = Tr2Effect.prototype.Initialize;
  t.mock.method(Tr2Effect.prototype, "Initialize", function()
  {
    // Exercise real material registration; only shader-file acquisition is suppressed.
    const path = this.effectFilePath;
    this.effectFilePath = "";
    try { return initialize.call(this); }
    finally { this.effectFilePath = path; }
  });
  const system = new Tr2GpuParticleSystem();
  system.update = new Tr2Effect();
  system.render = new Tr2Effect();
  const texture = new TriTextureParameter(), parameter = new Tr2Vector4Parameter();
  parameter.SetValue([1, 2, 3, 4]);
  for (const effect of [system.update, system.render])
  {
    effect.resources.Append(texture);
    effect.parameters.Append(parameter);
    effect.Initialize();
  }
  const helper = new Tr2GpuParticleSystemNoCompute(system);
  system._noCompute = helper;
  helper._EnsureEffects();
  const privateEffects = [helper._updateEffect, helper._emitEffect, helper._drawEffect];
  assert.equal(helper._updateEffect.parameters[0], parameter);
  assert.equal(helper._drawEffect.resources[0], texture);
  assert.deepEqual(new Set(texture._materials), new Set([system.update, system.render, helper._updateEffect, helper._drawEffect]));
  system.Destruct();
  system.Destruct();
  assert.deepEqual(new Set(texture._materials), new Set([system.update, system.render]));
  for (const effect of privateEffects)
  {
    assert.equal(effect._destroyed, true);
    assert.equal(effect.resources.length, 0);
  }
  for (const effect of [system.update, system.render])
  {
    assert.equal(effect._destroyed, false);
    assert.equal(effect.resources[0], texture);
    assert.equal(effect.parameters[0], parameter);
    effect.Initialize();
  }
  parameter.SetValue([5, 6, 7, 8]);
  assert.deepEqual(Array.from(system.render.parameters[0].value), [5, 6, 7, 8]);
  assert.deepEqual(new Set(texture._materials), new Set([system.update, system.render]));
  system.update.Destruct();
  system.render.Destruct();
});
