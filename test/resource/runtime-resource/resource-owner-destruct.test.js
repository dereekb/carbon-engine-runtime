import assert from "node:assert/strict";
import test from "node:test";
import "../../../npm/dist/index.js";
import "../../../npm/dist/character/index.js";
import { BlueAsyncRes, BlueResMan, blue } from "../../../npm/dist/blue/index.js";
import { IBlueAsyncResNotifyTarget } from "../../../npm/dist/blue/interfaces/IBlueAsyncResNotifyTarget.js";
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

// Both discovery directions matter: exercise hooks, and fail for an owner with
// no hook. A future private map/nested holder also needs its own fixture.
const hooks = getClassRegistrations().filter(({ type }) =>
  Object.hasOwn(type.prototype, "OnDestruct") && typeof type.prototype.RemoveCachedData === "function");
test("link-only teardown discovery exercises registered hooks", () => assert.ok(hooks.length));
for (const { name } of hooks) checkOwner(name);

test("every registered resource owner has a teardown hook, including abstract bases", () =>
{
  for (const { name, type } of getClassRegistrations())
  {
    if (type === IBlueAsyncResNotifyTarget || typeof type.prototype.RemoveCachedData !== "function") continue;
    assert.equal(typeof type.prototype.OnDestruct, "function", `${name}: resource owner has no teardown hook`);
  }
});

for (const primaryType of ["TriGrannyRes", "TriGeometryRes"])
{
  test(`animation teardown removes ${primaryType} primary and map links while preserving holders`, () =>
  {
    const previous = blue.resMan, manager = new BlueResMan();
    blue.resMan = manager;
    try
    {
      const Animation = getRegisteredConstructor("Tr2GrannyAnimation");
      const Resource = getRegisteredConstructor(primaryType), Granny = getRegisteredConstructor("TriGrannyRes");
      const owner = new Animation(), primary = new Resource(), secondary = new Granny();
      if (primaryType === "TriGeometryRes") owner.SetSharedGeometryRes(primary);
      else owner.SetGrannyResource(primary);
      owner.SetSecondaryGrannyResource("res:/alias-a.gr2", primary);
      owner.SetSecondaryGrannyResource("res:/alias-b.gr2", primary);
      owner.SetSecondaryGrannyResource("res:/secondary.gr2", secondary);
      owner.SetSecondaryGrannyResource("res:/pending.gr2", null);
      const map = owner._secondaryResources, entries = Array.from(map);
      assert.equal(manager.notify.GetByOwner(owner).length, 4);
      owner.OnDestruct(); owner.OnDestruct();
      assert.deepEqual(manager.notify.GetByOwner(owner), []);
      assert.deepEqual(manager.notify.GetByResource(primary), []);
      assert.deepEqual(manager.notify.GetByResource(secondary), []);
      assert.equal(owner.grannyRes, primary);
      assert.equal(owner._secondaryResources, map);
      assert.deepEqual(Array.from(map), entries);
    }
    finally { blue.resMan = previous; }
  });
}
