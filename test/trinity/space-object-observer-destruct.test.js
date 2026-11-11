import test from "node:test";
import { EveSpaceObject2 } from "../../npm/dist/trinity/index.js";
import { assertListObserverDestruct } from "../support/listObserverDestruct.js";

test("EveSpaceObject2 teardown detaches retained member-list observers", t =>
{
  assertListObserverDestruct(t, new EveSpaceObject2(), ["controllers","lights","effectChildren","overlayEffects","decals","attachments"]);
});
