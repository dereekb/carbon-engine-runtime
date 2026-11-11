import assert from "node:assert/strict";
import test from "node:test";
import { EveStretch3, Tr2DynamicBinding } from "../../npm/dist/trinity/index.js";
import { assertControllerDestruct } from "../support/controllerDestruct.js";

test("stretch teardown detaches retained dynamic-binding back pointers", () =>
{
  const owner = new EveStretch3(), peer = new EveStretch3();
  const binding = new Tr2DynamicBinding(), peerBinding = new Tr2DynamicBinding();
  owner.dynamicBindings.push(binding);
  binding.SetOwner(owner);
  peerBinding.SetOwner(peer);
  assertControllerDestruct(owner);
  assert.equal(binding._owner, null);
  assert.equal(peerBinding._owner, peer);
  assert.deepEqual(Array.from(owner.dynamicBindings), [binding]);
});
