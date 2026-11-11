import test from "node:test";
import assert from "node:assert/strict";
import { EveEntity, EveComponentRegistry } from "../../npm/dist/trinity/index.js";

test("entity destruction reports a live registry without inventing unregister cleanup", t =>
{
  const registry = new EveComponentRegistry(), entity = new EveEntity(), peer = new EveEntity();
  entity.Register(registry);
  peer.Register(registry);
  const error = t.mock.method(console, "error", () => {});
  const index = entity.indexInRegistry;
  entity.SetComponentState(1, 7);
  entity.Destruct();
  entity.Destruct();
  assert.equal(error.mock.callCount(), 1);
  assert.match(error.mock.calls[0].arguments[0], /still registered/);
  assert.equal(entity.registry, null);
  assert.equal(entity.indexInRegistry, index);
  assert.equal(entity.GetComponentIndex(1), 7);
  assert.deepEqual(registry.registeredEntities, [entity, peer]);
  assert.equal(peer.registry, registry);
  peer.UnRegister(registry);
  peer.Destruct();
  assert.equal(error.mock.callCount(), 1);
  registry.Clear();
});
