import test from "node:test";
import { EveMeshOverlayEffect } from "../../npm/dist/trinity/index.js";
import { assertListObserverDestruct } from "../support/listObserverDestruct.js";

test("EveMeshOverlayEffect teardown detaches retained member-list observers", t =>
{
  assertListObserverDestruct(t, new EveMeshOverlayEffect(), ["controllers"]);
});
