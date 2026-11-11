import assert from "node:assert/strict";
import test from "node:test";
// Load both public registration families: the main barrel excludes character.
import "../../../npm/dist/index.js";
import "../../../npm/dist/character/index.js";
import { BlueAsyncRes, BlueResMan, blue } from "../../../npm/dist/blue/index.js";
import { IBlueAsyncResNotifyTarget } from "../../../npm/dist/blue/interfaces/IBlueAsyncResNotifyTarget.js";
import { CjsSchema } from "../../../npm/dist/blue/schema/index.js";
import { getClassRegistrations, getRegisteredConstructor } from "../../../npm/dist/blue/exposure/classes/registry.js";
import { Tr2GrannyAnimation } from "../../../npm/dist/trinity/core/animation/Tr2GrannyAnimation.js";
import { TriGrannyRes } from "../../../npm/dist/resource/index.js";

function manager(t)
{
  const previous = blue.resMan;
  const current = new BlueResMan();
  blue.resMan = current;
  t.after(() => { blue.resMan = previous; });
  return current;
}

function assertRemoved(notify, owner, resource)
{
  const links = notify.GetByOwner(owner).filter(link => link.resource === resource);
  assert.ok(links.length > 0, "exercise registered links, never an empty owner");
  owner.RemoveCachedData(resource);
  for (const { holder, key } of links)
  {
    assert.equal(holder instanceof Map ? holder.get(key) : holder[key], null, `released slot ${String(key)}`);
  }
  assert.equal(notify.GetByOwner(owner).filter(link => link.resource === resource).length, 0);
  assert.equal(notify.GetByResource(resource).filter(link => link.owner === owner).length, 0);
  owner.RemoveCachedData(resource);
}

const discovered = getClassRegistrations().filter(({ type }) =>
  type !== IBlueAsyncResNotifyTarget && typeof type.prototype.RemoveCachedData === "function");
const owners = discovered.filter(({ type }) => !CjsSchema.getSchema(type).abstract);

test("resource-owner discovery has concrete registered classes", () =>
{
  assert.ok(owners.length > 0);
  assert.ok(owners.some(({ type }) => !Object.hasOwn(type.prototype, "RemoveCachedData")), "include inherited handlers");
  for (const { name, type } of discovered.filter(({ type }) => CjsSchema.getSchema(type).abstract))
  {
    // Tr2GrannyTrack's ResetTracks is pure virtual. Exercise its real callback
    // on registered concrete subclasses, without replacing the abstract method.
    assert.ok(owners.some(({ type: Concrete }) =>
      Concrete.prototype instanceof type && Concrete.prototype.RemoveCachedData === type.prototype.RemoveCachedData),
    `${name}: abstract callback must be exercised by a concrete subclass`);
  }
});

for (const { name, type: Owner } of owners)
{
  test(`${name}: RemoveCachedData clears every declared resource slot`, t =>
  {
    const { notify } = manager(t);
    const owner = new Owner();
    const slots = CjsSchema.getSchema(Owner).fields.flatMap(field =>
    {
      const Resource = getRegisteredConstructor(field.type?.className);
      return Resource && (Resource === BlueAsyncRes || Resource.prototype instanceof BlueAsyncRes)
        ? [{ key: field.name, Resource }] : [];
    });
    assert.ok(slots.length > 0, `${name}: add a reviewed map/nested-holder fixture if no direct resource slots exist`);

    // Distinct resources prove removing one leaves the others linked.
    const distinct = slots.map(({ key, Resource }) =>
    {
      const resource = new Resource();
      owner[key] = resource;
      notify.Add(owner, resource, owner, key);
      return resource;
    });
    assert.equal(notify.GetByOwner(owner).length, slots.length);
    distinct.forEach((resource, index) =>
    {
      assertRemoved(notify, owner, resource);
      assert.equal(notify.GetByOwner(owner).length, slots.length - index - 1);
    });

    // A shared resource in multiple slots must clear all aliases in one callback.
    const shared = new Map();
    for (const { key, Resource } of slots)
    {
      if (!shared.has(Resource)) shared.set(Resource, new Resource());
      const resource = shared.get(Resource);
      owner[key] = resource;
      notify.Add(owner, resource, owner, key);
    }
    assert.equal(notify.GetByOwner(owner).length, slots.length);
    for (const resource of shared.values()) assertRemoved(notify, owner, resource);
    assert.deepEqual(notify.GetByOwner(owner), []);
  });
}

test("Granny animation clears primary and secondary map aliases without deleting paths", t =>
{
  const { notify } = manager(t), owner = new Tr2GrannyAnimation();
  const resource = new TriGrannyRes(), other = new TriGrannyRes();
  owner.SetGrannyResource(resource);
  owner.SetSecondaryGrannyResource("res:/first.gr2", resource);
  owner.SetSecondaryGrannyResource("res:/second.gr2", resource);
  owner.SetSecondaryGrannyResource("res:/other.gr2", other);
  assert.equal(notify.GetByOwner(owner).length, 4);
  assertRemoved(notify, owner, resource);
  assert.equal(owner.grannyRes, null);
  assert.equal(owner._secondaryResources.get("res:/first.gr2"), null);
  assert.equal(owner._secondaryResources.get("res:/second.gr2"), null);
  assert.equal(owner._secondaryResources.get("res:/other.gr2"), other);
  assert.equal(owner._secondaryResources.size, 3);
  assert.equal(notify.GetByOwner(owner).length, 1);
  assertRemoved(notify, owner, other);
  assert.deepEqual(notify.GetByOwner(owner), []);
});

test("contract assertion rejects an owner that unregisters but retains its slot", t =>
{
  const { notify } = manager(t), resource = new BlueAsyncRes();
  const owner = { resource, RemoveCachedData(value) { notify.Remove(this, value); } };
  notify.Add(owner, resource, owner, "resource");
  assert.throws(() => assertRemoved(notify, owner, resource), /released slot resource/);
});
