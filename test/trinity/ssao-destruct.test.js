import test from "node:test";
import { Tr2SSAO } from "../../npm/dist/trinity/index.js";
import { assertOwnedConstantBufferDestruct } from "../support/ownedConstantBufferDestruct.js";

test("Tr2SSAO public teardown releases owned constant-buffer shares once", () =>
{
  assertOwnedConstantBufferDestruct(new Tr2SSAO(), ["_cortaoConstantBuffer"]);
});
