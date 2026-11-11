import test from "node:test";
import { EveStretch3 } from "../../npm/dist/trinity/index.js";
import { assertListObserverDestruct } from "../support/listObserverDestruct.js";

test("EveStretch3 teardown detaches retained member-list observers", t =>
{
  assertListObserverDestruct(t, new EveStretch3(), ["controllers","dynamicBindings"]);
});
