import test from "node:test";
import { EveMultiEffect } from "../../npm/dist/trinity/index.js";
import { assertListObserverDestruct } from "../support/listObserverDestruct.js";

test("EveMultiEffect teardown detaches retained member-list observers", t =>
{
  assertListObserverDestruct(t, new EveMultiEffect(), ["bindings","parameters","controllers"]);
});
