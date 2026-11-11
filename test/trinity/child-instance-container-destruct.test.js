import assert from "node:assert/strict";
import test from "node:test";
import { EveChildInstanceContainer, EveChildTransform } from "../../npm/dist/trinity/index.js";
import { assertChildOwnerDestruct } from "../support/childOwnerDestruct.js";

test("instance-container teardown detaches its source and every retained instance", () =>
{
  const owner = new EveChildInstanceContainer(), instance = new EveChildTransform();
  owner.OnDestruct();
  owner.instances.push(instance);
  owner.RegisterChild(instance);
  assertChildOwnerDestruct(owner, "_source");
  assert.equal(instance.GetParent(), null);
  assert.equal(instance.GetOwner(), null);
  assert.deepEqual(Array.from(owner.instances), [instance]);
});
