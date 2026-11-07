import assert from "node:assert/strict";
import test from "node:test";
import { Tr2ParticleSystem } from "../../npm/dist/trinity/index.js";
import { NotifyModified } from "../../npm/dist/blue/index.js";

test("particle batch handles sorting, clock rebasing and both emitter notifications", () =>
{
  const system = new Tr2ParticleSystem();
  try
  {
    system.maxParticleCount = 5;
    system.requiresSorting = true;
    system.useSimTimeRebase = true;
    const calls = [];
    system.emitParticleOnDeathEmitter = { SetThreadSafeFlag() { calls.push("death"); } };
    system.emitParticleDuringLifeEmitter = { SetThreadSafeFlag() { calls.push("alive"); } };
    const names = ["requiresSorting", "useSimTimeRebase", "emitParticleOnDeathEmitter", "emitParticleDuringLifeEmitter"];
    system.OnModified("name");
    assert.equal(system._indexes.length, 0);
    assert.deepEqual(calls, []);
    NotifyModified(system, names);
    assert.equal(system._indexes.length, 5);
    assert.deepEqual(calls, ["death", "alive"]);
    // m_lastUpdate is Be::Time; the rebase adds the tick difference (Tr2ParticleSystem.cpp:474-477).
    system._lastUpdate = 90_000_000;
    system.OnSimClockRebase(10000000, 30000000);
    assert.equal(system._lastUpdate, 110_000_000);
    system.requiresSorting = false;
    system.useSimTimeRebase = false;
    system.OnModified(["requiresSorting", "useSimTimeRebase"]);
    assert.equal(system._indexes.length, 0);
    system.useSimTimeRebase = true;
    system.OnModified("useSimTimeRebase");
  }
  finally { system.Destruct(); }
});

test("particle initialization flags emitters, and useSimTimeRebase never reaches the refusing OS", () =>
{
  const system = new Tr2ParticleSystem();
  try
  {
    const calls = [];
    system.useSimTimeRebase = true;
    system.emitParticleOnDeathEmitter = { SetThreadSafeFlag() { calls.push("death"); } };
    system.emitParticleDuringLifeEmitter = { SetThreadSafeFlag() { calls.push("alive"); } };
    assert.equal(system.Initialize(), true);
    assert.deepEqual(calls, ["death", "alive"]);
  }
  finally { system.Destruct(); }
});
