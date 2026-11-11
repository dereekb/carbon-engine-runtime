import test from "node:test";
import { EveChildSocket, EveChildPlug } from "../../npm/dist/trinity/index.js";
import { assertChildOwnerDestruct } from "../support/childOwnerDestruct.js";

test("socket teardown detaches its retained plug", () =>
{
  const owner = new EveChildSocket();
  owner.OnDestruct();
  assertChildOwnerDestruct(owner, "plug", new EveChildPlug());
});
