import test from "node:test";
import { EveChildPlug } from "../../npm/dist/trinity/index.js";
import { assertListObserverDestruct } from "../support/listObserverDestruct.js";

test("EveChildPlug teardown detaches retained member-list observers", t =>
{
  assertListObserverDestruct(t, new EveChildPlug(), ["controllers"]);
});
