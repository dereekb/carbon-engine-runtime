import test from "node:test";
import { EveEffectRoot2 } from "../../npm/dist/trinity/index.js";
import { assertListObserverDestruct } from "../support/listObserverDestruct.js";

test("EveEffectRoot2 teardown detaches retained member-list observers", t =>
{
  assertListObserverDestruct(t, new EveEffectRoot2(), ["controllers","effectChildren","lights"]);
});
