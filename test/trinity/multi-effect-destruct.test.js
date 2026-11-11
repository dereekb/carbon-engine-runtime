import assert from "node:assert/strict";
import test from "node:test";
import { EveMultiEffect, EveMultiEffectParameter, Tr2DynamicBinding } from "../../npm/dist/trinity/index.js";
import { assertControllerDestruct } from "../support/controllerDestruct.js";

test("multi-effect teardown detaches retained parameter and binding back pointers", () =>
{
  const owner = new EveMultiEffect(), peer = new EveMultiEffect();
  const parameter = new EveMultiEffectParameter(), binding = new Tr2DynamicBinding();
  const peerParameter = new EveMultiEffectParameter(), peerBinding = new Tr2DynamicBinding();
  owner.parameters.push(parameter);
  owner.bindings.push(binding);
  parameter.SetOwner(owner);
  binding.SetOwner(owner);
  peerParameter.SetOwner(peer);
  peerBinding.SetOwner(peer);
  assertControllerDestruct(owner);
  assert.equal(parameter._owner, null);
  assert.equal(binding._owner, null);
  assert.equal(peerParameter._owner, peer);
  assert.equal(peerBinding._owner, peer);
  assert.deepEqual(Array.from(owner.parameters), [parameter]);
  assert.deepEqual(Array.from(owner.bindings), [binding]);
});
