import test from "node:test";
import assert from "node:assert/strict";
import { Tr2Effect, Tr2GpuParticleSystem } from "../../npm/dist/trinity/index.js";
import { assertOwnedConstantBufferDestruct } from "../support/ownedConstantBufferDestruct.js";

test("Tr2GpuParticleSystem public teardown releases owned constant-buffer shares once", () =>
{
  assertOwnedConstantBufferDestruct(new Tr2GpuParticleSystem(), ["_emitCB","_updateCB","_sortCB"]);
});

test("Tr2GpuParticleSystem public teardown detaches all nine authored effect stores without destroying effects", () =>
{
  const system = new Tr2GpuParticleSystem();
  const slots = ["emit", "update", "render", "clear", "setDrawParameters", "setSortParameters", "sort", "sortStep", "sortInner"];
  const store = system._variableStore;
  for (const slot of slots)
  {
    system[slot] = new Tr2Effect();
    system.SetVariableStore(system[slot]);
    assert.equal(system[slot].variableStore, store, slot);
  }
  system.Destruct();
  system.Destruct();
  assert.equal(system._variableStore, null);
  for (const slot of slots)
  {
    const effect = system[slot];
    assert.equal(effect.variableStore, null, slot);
    assert.equal(effect._destroyed, false, slot);
    effect.SetVariableStore(store);
    assert.equal(effect.GetVariableStore(), store, `${slot} remains usable`);
    effect.Destruct();
  }
});
