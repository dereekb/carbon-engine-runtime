import test from "node:test";
import assert from "node:assert/strict";
import { Tr2DynamicBinding, Tr2FloatParameter } from "../../npm/dist/trinity/index.js";

test("dynamic binding destruction detaches its reroute and leaves peer bindings usable", t =>
{
  const source = new Tr2FloatParameter(), destination = new Tr2FloatParameter();
  const owner = { GetParameterMap: () => ({ Source: source, Destination: destination }) };
  const bindings = [new Tr2DynamicBinding(), new Tr2DynamicBinding()];
  for (const binding of bindings)
  {
    binding.sourceObjectPath = "Source";
    binding.destinationObjectPath = "Destination";
    binding.sourceObjectAttribute = binding.destinationObjectAttribute = "value";
    binding.SetOwner(owner);
    assert.equal(binding.Link(), true);
  }
  const [binding, peer] = bindings;
  const held = binding.binding;
  const unregister = t.mock.method(destination, "UnregisterBinding");
  binding.Destruct();
  binding.Destruct();
  assert.equal(unregister.mock.callCount(), 1);
  assert.equal(unregister.mock.calls[0].arguments[0], held);
  assert.equal(binding.binding, null);
  assert.equal(binding.source, null);
  assert.equal(binding.destination, null);
  assert.equal(binding._owner, null);
  assert.equal(binding._bindingTime, 0);
  assert.equal(binding.Link(), false);
  source.SetValue(19);
  assert.equal(peer.Update(Number.MAX_SAFE_INTEGER), true);
  assert.equal(destination.GetValue(), 19);
  peer.Destruct();
  assert.equal(unregister.mock.callCount(), 2);
});
