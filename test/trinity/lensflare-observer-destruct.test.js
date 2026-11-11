import test from "node:test";
import { EveLensflare } from "../../npm/dist/trinity/index.js";
import { assertListObserverDestruct } from "../support/listObserverDestruct.js";

test("EveLensflare teardown detaches retained member-list observers", t =>
{
  assertListObserverDestruct(t, new EveLensflare(), ["controllers"]);
});
