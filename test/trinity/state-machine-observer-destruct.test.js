import test from "node:test";
import { Tr2StateMachine } from "../../npm/dist/trinity/index.js";
import { assertListObserverDestruct } from "../support/listObserverDestruct.js";

test("Tr2StateMachine teardown detaches retained member-list observers", t =>
{
  const owner = new Tr2StateMachine();
  assertListObserverDestruct(t, owner, ["states"], owner.Destruct.bind(owner));
});
