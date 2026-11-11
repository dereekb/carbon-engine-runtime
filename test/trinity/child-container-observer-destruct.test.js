import test from "node:test";
import { EveChildContainer } from "../../npm/dist/trinity/index.js";
import { assertListObserverDestruct } from "../support/listObserverDestruct.js";

test("EveChildContainer teardown detaches retained member-list observers", t =>
{
  assertListObserverDestruct(t, new EveChildContainer(), ["controllers","objects","attachments","lights"]);
});
