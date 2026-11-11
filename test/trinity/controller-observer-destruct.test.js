import test from "node:test";
import { Tr2Controller } from "../../npm/dist/trinity/index.js";
import { assertListObserverDestruct } from "../support/listObserverDestruct.js";

test("Tr2Controller teardown detaches retained member-list observers", t =>
{
  const owner = new Tr2Controller();
  assertListObserverDestruct(t, owner, ["stateMachines","variables","eventHandlers"], owner.Destruct.bind(owner));
});
