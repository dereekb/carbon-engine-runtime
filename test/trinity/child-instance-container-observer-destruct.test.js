import test from "node:test";
import { EveChildInstanceContainer } from "../../npm/dist/trinity/index.js";
import { assertListObserverDestruct } from "../support/listObserverDestruct.js";

test("EveChildInstanceContainer teardown detaches retained member-list observers", t =>
{
  assertListObserverDestruct(t, new EveChildInstanceContainer(), ["transformModifiers"]);
});
