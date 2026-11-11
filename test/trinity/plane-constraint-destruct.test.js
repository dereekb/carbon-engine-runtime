import test from "node:test";
import { Tr2PlaneConstraint } from "../../npm/dist/trinity/index.js";
import { assertListObserverDestruct } from "../support/listObserverDestruct.js";

test("Tr2PlaneConstraint public teardown detaches retained list observers", t =>
{
  const owner = new Tr2PlaneConstraint();
  assertListObserverDestruct(t, owner, ["onCollisionEmitters"], owner.Destruct.bind(owner));
});
