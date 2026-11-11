import test from "node:test";
import { EveChildRef } from "../../npm/dist/trinity/index.js";
import { assertChildOwnerDestruct } from "../support/childOwnerDestruct.js";

test("child-ref teardown detaches its retained child", () =>
{
  const owner = new EveChildRef();
  owner.OnDestruct();
  assertChildOwnerDestruct(owner, "child");
});
