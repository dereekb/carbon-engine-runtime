import assert from "node:assert/strict";
import test from "node:test";
import "../../../npm/dist/index.js";
import "../../../npm/dist/character/index.js";
import { BlueAsyncRes, BlueResMan, blue } from "../../../npm/dist/blue/index.js";
import { CjsSchema } from "../../../npm/dist/blue/schema/index.js";
import { getClassRegistrations, getRegisteredConstructor } from "../../../npm/dist/blue/exposure/classes/registry.js";

function checkOwner(name)
{
  const Base = getRegisteredConstructor(name);
  test(`${name}: link-only OnDestruct covers its concrete owners`, async t =>
  {
    assert.equal(typeof Base.prototype.OnDestruct, "function");
    const owners = getClassRegistrations().filter(({ type }) =>
      type.prototype.OnDestruct === Base.prototype.OnDestruct && !CjsSchema.getSchema(type).abstract);
    assert.ok(owners.length);
    for (const { name: ownerName, type: Owner } of owners)
    {
      await t.test(ownerName, () =>
      {
        const previous = blue.resMan, manager = new BlueResMan();
        blue.resMan = manager;
        try
        {
          const owner = new Owner(), peer = new Owner();
          const slots = CjsSchema.getSchema(Owner).fields.flatMap(field =>
          {
            const Resource = getRegisteredConstructor(field.type?.className);
            return Resource && Resource.prototype instanceof BlueAsyncRes
              ? [{ key: field.name, resource: new Resource() }] : [];
          });
          assert.ok(slots.length, "must exercise real linked slots");
          for (const { key, resource } of slots)
          {
            owner[key] = peer[key] = resource;
            manager.notify.Add(owner, resource, owner, key);
            manager.notify.Add(peer, resource, peer, key);
          }
          assert.equal(manager.notify.GetByOwner(owner).length, slots.length);
          owner.OnDestruct(); owner.OnDestruct();
          assert.deepEqual(manager.notify.GetByOwner(owner), []);
          assert.equal(manager.notify.GetByOwner(peer).length, slots.length);
          for (const { key, resource } of slots)
          {
            assert.equal(owner[key], resource, "link-only hook does not perform item 4 teardown");
            assert.deepEqual(manager.notify.GetByResource(resource).map(link => link.owner), [peer]);
          }
          peer.OnDestruct();
          assert.deepEqual(manager.notify.GetByOwner(peer), []);
        }
        finally { blue.resMan = previous; }
      });
    }
  });
}

// As each link-only hook lands, its own and inherited concrete owners enter
// this suite automatically. Completion coverage is checked after all hooks land.
const hooks = getClassRegistrations().filter(({ type }) =>
  Object.hasOwn(type.prototype, "OnDestruct") && typeof type.prototype.RemoveCachedData === "function");
test("link-only teardown discovery exercises registered hooks", () => assert.ok(hooks.length));
for (const { name } of hooks) checkOwner(name);
