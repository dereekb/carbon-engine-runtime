import test from "node:test";
import { Tr2SphereConstraint } from "../../npm/dist/trinity/index.js";
import { assertListObserverDestruct } from "../support/listObserverDestruct.js";

test("Tr2SphereConstraint public teardown detaches retained list observers", t =>
{
  const owner = new Tr2SphereConstraint();
  assertListObserverDestruct(t, owner, ["onCollisionEmitters"], owner.Destruct.bind(owner));
});
