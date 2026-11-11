import test from "node:test";
import { Tr2VolumetricsRenderer } from "../../npm/dist/trinity/index.js";
import { assertOwnedConstantBufferDestruct } from "../support/ownedConstantBufferDestruct.js";

test("Tr2VolumetricsRenderer public teardown releases owned constant-buffer shares once", () =>
{
  assertOwnedConstantBufferDestruct(new Tr2VolumetricsRenderer(), ["_fogConstantBuffer"]);
});
