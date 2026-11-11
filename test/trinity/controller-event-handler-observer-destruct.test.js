import test from "node:test";
import { Tr2ControllerEventHandler } from "../../npm/dist/trinity/index.js";
import { assertListObserverDestruct } from "../support/listObserverDestruct.js";

test("Tr2ControllerEventHandler teardown detaches retained member-list observers", t =>
{
  const owner = new Tr2ControllerEventHandler();
  assertListObserverDestruct(t, owner, ["actions"], owner.Destruct.bind(owner));
});
