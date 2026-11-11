import test from "node:test";
import { Tr2GpuParticleSystem } from "../../npm/dist/trinity/index.js";
import { assertOwnedConstantBufferDestruct } from "../support/ownedConstantBufferDestruct.js";

test("Tr2GpuParticleSystem public teardown releases owned constant-buffer shares once", () =>
{
  assertOwnedConstantBufferDestruct(new Tr2GpuParticleSystem(), ["_emitCB","_updateCB","_sortCB"]);
});
