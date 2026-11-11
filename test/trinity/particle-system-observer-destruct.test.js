import test from "node:test";
import { Tr2ParticleSystem } from "../../npm/dist/trinity/index.js";
import { assertListObserverDestruct } from "../support/listObserverDestruct.js";

test("Tr2ParticleSystem teardown detaches retained member-list observers", t =>
{
  assertListObserverDestruct(t, new Tr2ParticleSystem(), ["constraints"]);
});
