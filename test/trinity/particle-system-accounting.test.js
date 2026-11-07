// Tr2ParticleSystem's process-wide accounting (Tr2ParticleSystem.cpp:16-21,
// 350-427, 844-878): the registry of live systems, the capacity every built
// system holds, and the cpuMaxParticleCount cap on dynamic systems.
import test from "node:test";
import assert from "node:assert/strict";
import { Tr2ParticleSystem, Tr2ParticleElementDeclaration, Tr2RenderContext_GetMainThreadRenderContext, TriDevice } from "../../npm/dist/trinity/index.js";
import { Tr2RenderContextALStub } from "../../npm/dist/trinityal/index.js";
import { InitializeTrinityStub } from "../support/trinityStub.js";

function positionSystem(maxParticleCount, dynamic = true)
{
  const system = new Tr2ParticleSystem();
  const declaration = new Tr2ParticleElementDeclaration();
  declaration.elementType = Tr2ParticleElementDeclaration.Type.POSITION;
  system.updateSimulation = dynamic;
  system.maxParticleCount = maxParticleCount;
  system.elements.push(declaration);
  assert.equal(system.UpdateElementDeclaration(), true);
  return system;
}

test("the registry holds a system from its first use until Destruct, and use cannot revive it", () =>
{
  const system = new Tr2ParticleSystem();
  assert.ok(!Tr2ParticleSystem.getAllSystems().has(system), "built and never used is never listed");

  system.IsGood();
  assert.ok(Tr2ParticleSystem.getAllSystems().has(system));

  system.Destruct();
  assert.ok(!Tr2ParticleSystem.getAllSystems().has(system));

  system.IsGood();
  assert.ok(!Tr2ParticleSystem.getAllSystems().has(system));
});

test("idle expiry takes a system off the list and keeps its particles; the next use brings it back", t =>
{
  const ambient = Tr2RenderContext_GetMainThreadRenderContext();
  const previousAL = ambient.GetRenderContextAL();
  const al = new Tr2RenderContextALStub();
  ambient.SetRenderContextAL(al);
  al.CreateDevice();
  t.after(() => ambient.SetRenderContextAL(previousAL));
  InitializeTrinityStub();

  const system = positionSystem(10);
  const savedTime = TriDevice.activeTime;
  try
  {
    system.aliveCount = 3;
    system.IsGood();
    assert.ok(system.PrepareResources());
    assert.ok(system.GetGpuBuffer());

    TriDevice.activeTime = system._stamp + (TriDevice.resourceIdleRule + 1) * 10000000;
    TriDevice.CollectResources();
    assert.ok(!Tr2ParticleSystem.getAllSystems().has(system));
    assert.equal(system.GetGpuBuffer(), null);
    assert.equal(system.aliveCount, 3, "CPU particles survive the release");
    assert.ok(!TriDevice.GetResourcesRegistered().includes(system));

    assert.equal(system.IsGood(), false, "not prepared again until the device tick");
    assert.ok(Tr2ParticleSystem.getAllSystems().has(system));
    assert.ok(TriDevice.GetResourcesRegistered().includes(system));
    assert.ok(system.PrepareResources());
    assert.equal(system.aliveCount, 3);
    assert.ok(system.GetGpuBuffer());
  }
  finally
  {
    TriDevice.activeTime = savedTime;
    system.Destruct();
  }
});

test("a device reset or a declaration rebuild does not take a system off the list", () =>
{
  const device = InitializeTrinityStub();
  const system = positionSystem(10);
  system.IsGood();

  device.ReleaseDeviceResources();
  assert.ok(Tr2ParticleSystem.getAllSystems().has(system));
  assert.ok(TriDevice.GetResourcesRegistered().includes(system));

  assert.equal(system.UpdateElementDeclaration(), true);
  assert.ok(Tr2ParticleSystem.getAllSystems().has(system));
  system.Destruct();
});

test("built buffers claim capacity, Destruct and resizing return it, and dynamic systems are capped", () =>
{
  const savedCap = Tr2ParticleSystem.cpuMaxParticleCount;
  const base = Tr2ParticleSystem._totalParticleCount;
  try
  {
    const first = positionSystem(100);
    assert.equal(Tr2ParticleSystem._totalParticleCount, base + 100);

    assert.equal(first.SetMaxParticleCount(40), 40);
    assert.equal(Tr2ParticleSystem._totalParticleCount, base + 40, "resizing returns the old capacity first");

    // A dynamic system that would reach the cap gets no buffers and zero capacity.
    Tr2ParticleSystem.cpuMaxParticleCount = base + 100;
    const capped = positionSystem(60);
    assert.equal(capped.maxParticleCount, 0);
    assert.equal(Tr2ParticleSystem._totalParticleCount, base + 40);

    // Only dynamic systems are capped (cpp:399-407).
    const staticSystem = positionSystem(60, false);
    assert.equal(staticSystem.maxParticleCount, 60);
    assert.equal(Tr2ParticleSystem._totalParticleCount, base + 100);

    first.Destruct();
    staticSystem.Destruct();
    capped.Destruct();
    assert.equal(Tr2ParticleSystem._totalParticleCount, base);
  }
  finally
  {
    Tr2ParticleSystem.cpuMaxParticleCount = savedCap;
  }
});

test("updateAllSystems updates every live system; the same-time guard never fires (cpp:848-856 quirk)", () =>
{
  const seen = [];
  const systems = [ new Tr2ParticleSystem(), new Tr2ParticleSystem() ];
  for (const system of systems)
  {
    system.Update = args => seen.push([ system, args ]);
    system.IsGood();
  }
  const args = { time: 5 };

  Tr2ParticleSystem.updateAllSystems(args);
  Tr2ParticleSystem.updateAllSystems(args);
  for (const system of systems)
  {
    assert.equal(seen.filter(([ s ]) => s === system).length, 2);
    system.Destruct();
  }
});
