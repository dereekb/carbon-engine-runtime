import test from "node:test";
import { EveChildProceduralContainer } from "../../npm/dist/trinity/index.js";
import { assertChildOwnerDestruct } from "../support/childOwnerDestruct.js";

test("procedural-container teardown detaches its retained selection", () =>
{
  const owner = new EveChildProceduralContainer();
  owner.OnDestruct();
  assertChildOwnerDestruct(owner, "selectedObject");
});
