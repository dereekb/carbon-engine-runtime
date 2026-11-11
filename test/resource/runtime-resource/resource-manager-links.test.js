import assert from "node:assert/strict";
import { test } from "node:test";
import { BlueAsyncRes, BlueResMan, MotherLode, blue } from "../../../npm/dist/blue/index.js";
import { RegisterDataLoader } from "../../support/testDataRes.js";
import "../../support/frameLoop.js";

/**
 * An owner that records its callbacks and, as a real holder does, lets go of an
 * expired resource itself: every own field and every listed Map slot holding it.
 * @param {Array<Array>} calls Receives each callback and its resource.
 * @param {object} [fields] The owner's fields.
 * @param {Map[]} [maps] Maps whose slots the owner holds.
 * @returns {object}
 */
function holder(calls, fields = {}, maps = [])
{
  const owner = {
    ...fields,
    RebuildCachedData(value) { calls.push(["rebuild", value]); },
    ReleaseCachedData(value) { calls.push(["release", value]); },
    RemoveCachedData(value)
    {
      calls.push(["remove", value]);
      for (const key of Object.keys(owner)) if (owner[key] === value) owner[key] = null;
      for (const map of maps) for (const [ key, held ] of map) if (held === value) map.set(key, null);
    }
  };
  return owner;
}

/** A manager with deterministic milliseconds, without network or loading work. */
function fixture()
{
  let time = 0;
  const manager = new BlueResMan({ motherLode: new MotherLode({ now: () => time }), autoPurgePolicy: false });
  manager.linkExpirySeconds = 1;
  const resource = new BlueAsyncRes();
  const calls = [];
  const owner = holder(calls, { resource });
  return { manager, resource, owner, calls, advance(value) { time = value; manager.activityTime = value; } };
}

test("manager notification tracking is isolated and remains usable after Clear", () =>
{
  const first = fixture();
  const second = fixture();
  const resource = first.resource;
  second.owner.resource = resource;
  first.manager.notify.Add(first.owner, resource, first.owner, "resource");
  second.manager.notify.Add(second.owner, resource, second.owner, "resource");

  first.manager.Clear();
  first.manager.Clear();
  assert.equal(first.owner.resource, null);
  assert.deepEqual(first.calls, [["remove", resource]]);
  assert.equal(first.manager.notify.GetByResource(resource).length, 0);
  assert.equal(second.owner.resource, resource);
  assert.equal(second.manager.notify.GetByResource(resource).length, 1);
  assert.deepEqual(second.calls, []);

  first.owner.resource = resource;
  first.manager.notify.Add(first.owner, resource, first.owner, "resource");
  first.manager.notify.RebuildCachedData(resource);
  assert.deepEqual(first.calls, [["remove", resource], ["rebuild", resource]]);
  assert.deepEqual(second.calls, []);
  first.manager.Clear();
  second.manager.Clear();
});

test("notify.Update reads its owner's current clock and link expiry", () =>
{
  const { manager, resource, owner, advance } = fixture();
  manager.notify.Add(owner, resource, owner, "resource");
  advance(1100);
  manager.linkExpirySeconds = 2;
  manager.notify.Update();
  assert.equal(owner.resource, resource);

  manager.linkExpirySeconds = null;
  manager.SetAutoPurgePolicy({ maxIdleMilliseconds: 1000 });
  manager.notify.Update();
  assert.equal(owner.resource, null);
  assert.equal(manager.notify.GetByOwner(owner).length, 0);
});

test("manager registration rebuilds prepared resources immediately and remains registered for reload", () =>
{
  const { manager, resource, owner, calls } = fixture();
  resource._SetPrepared(true);
  resource._SetGood(true);
  manager.notify.Add(owner, resource, owner, "resource");
  manager.notify.Add(owner, resource, owner, "resource");
  assert.deepEqual(calls, [["rebuild", resource]], "Carbon BlueAsyncRes.cpp:275-278 immediate prepared callback; repeated link registration is idempotent");
  manager.notify.ReleaseCachedData(resource);
  manager.notify.RebuildCachedData(resource);
  assert.deepEqual(calls.map(call => call[0]), ["rebuild", "release", "rebuild"]);
  assert.equal(manager.notify.GetByOwner(owner).length, 1);
  manager.notify.Remove(owner, resource);
  manager.notify.RebuildCachedData(resource);
  assert.equal(calls.length, 3);
  assert.equal(manager.notify.GetByResource(resource).length, 0);
});

test("waiting owners rebuild on completion and notification tolerates link removal", () =>
{
  const { manager, resource, owner, calls } = fixture();
  manager.notify.Add(owner, resource, owner, "resource");
  assert.equal(calls.length, 0);
  owner.RebuildCachedData = value =>
  {
    calls.push(["rebuild", value]);
    manager.notify.Remove(owner, value);
    owner.resource = null;
  };
  manager.notify.RebuildCachedData(resource);
  assert.equal(calls.length, 1);
  assert.equal(manager.notify.GetByOwner(owner).length, 0);
});

test("link renewal is per owner; expiry has the owner let go and preserves a busy peer", () =>
{
  const state = fixture();
  const { manager, resource, owner, calls } = state;
  const peer = holder([], { resource });
  peer.RemoveCachedData = () => { throw new Error("renewed peer expired"); };
  manager.notify.Add(owner, resource, owner, "resource");
  manager.notify.Add(peer, resource, peer, "resource");
  state.advance(900);
  assert.equal(manager.notify.KeepAlive(peer, resource), true);
  state.advance(1100);
  manager.PurgeInactive({ time: 1100 });
  assert.deepEqual(calls, [["remove", resource]]);
  assert.equal(owner.resource, null);
  assert.equal(peer.resource, resource);
  assert.equal(manager.notify.GetByResource(resource).length, 1);
  assert.equal(manager.notify.KeepAlive(owner, resource), false);
});

test("expiry never touches a replacement, including one the owner installs while letting go", () =>
{
  const state = fixture();
  const { manager, resource, owner, calls } = state;
  const replacement = new BlueAsyncRes();
  manager.notify.Add(owner, resource, owner, "resource");
  owner.resource = replacement;
  state.advance(1100);
  manager.PurgeInactive({ time: 1100 });
  assert.equal(owner.resource, replacement);
  assert.deepEqual(calls, [["remove", resource]], "the owner handles its replaced slot");
  assert.equal(manager.notify.GetByOwner(owner).length, 0);

  owner.resource = resource;
  owner.RemoveCachedData = () => { owner.resource = replacement; };
  manager.notify.Add(owner, resource, owner, "resource");
  state.advance(2200);
  manager.PurgeInactive({ time: 2200 });
  assert.equal(owner.resource, replacement);
});

test("explicit resource eviction clears every owner before data purge and permits re-registration", () =>
{
  const { manager, resource, owner, calls } = fixture();
  manager.notify.Add(owner, resource, owner, "resource");
  manager.notify.Clear(resource);
  assert.equal(owner.resource, null);
  assert.deepEqual(calls, [["remove", resource]]);
  owner.resource = resource;
  manager.notify.Add(owner, resource, owner, "resource");
  manager.notify.RebuildCachedData(resource);
  assert.deepEqual(calls.map(call => call[0]), ["remove", "rebuild"]);
  manager.Clear();
  assert.equal(owner.resource, null);
  assert.equal(manager.notify.GetByOwner(owner).length, 0);
});

test("one owner can hold two resources and diagnostic snapshots cannot mutate live links", () =>
{
  const { manager, resource, owner, calls } = fixture();
  const other = new BlueAsyncRes();
  owner.other = other;
  manager.notify.Add(owner, resource, owner, "resource");
  manager.notify.Add(owner, other, owner, "other");
  const snapshot = manager.notify.GetByOwner(owner);
  snapshot[0].key = "other";
  manager.notify.Clear(resource);
  assert.equal(owner.resource, null);
  assert.equal(owner.other, other);
  assert.deepEqual(calls, [["remove", resource]]);
  assert.equal(manager.notify.GetByOwner(owner).length, 1);
});

test("two owner fields sharing one resource are let go once, and both clear", () =>
{
  const { manager, resource, owner, calls } = fixture();
  owner.other = resource;
  manager.notify.Add(owner, resource, owner, "resource");
  manager.notify.Add(owner, resource, owner, "other");
  manager.notify.Clear(resource);
  assert.equal(owner.resource, null);
  assert.equal(owner.other, null);
  assert.deepEqual(calls, [["remove", resource]]);
  assert.equal(manager.notify.GetByResource(resource).length, 0);
});

/** Real asynchronous load queues with synthetic data and a restored global manager. */
function loadingFixture(t)
{
  const previous = blue.resMan;
  let input = "{}";
  const manager = new BlueResMan({ source: { Read: () => input }, autoPurgePolicy: false });
  blue.resMan = manager;
  RegisterDataLoader(manager, "json", value => JSON.parse(value));
  t.after(() => { try { manager.Clear(); } finally { blue.resMan = previous; } });
  const resource = manager.GetResource("res:/owner-links.json");
  const calls = [];
  const owner = holder(calls, { resource });
  manager.notify.Add(owner, resource, owner, "resource");
  return { manager, resource, owner, calls, setInput(value) { input = value; } };
}

test("native loading and explicit reload notify registered owners without a readiness poll", async t =>
{
  const { manager, resource, owner, calls } = loadingFixture(t);
  await manager.Ready(resource);
  assert.deepEqual(calls, [["rebuild", resource]]);
  resource.Reload();
  assert.deepEqual(calls.map(call => call[0]), ["rebuild", "release"]);
  await manager.Ready(resource);
  assert.deepEqual(calls.map(call => call[0]), ["rebuild", "release", "rebuild"]);
  assert.equal(owner.resource, resource);
  assert.equal(manager.notify.GetByOwner(owner).length, 1);
});

test("failed reload releases cached data and retains the link for a later successful reload", async t =>
{
  const { manager, resource, owner, calls, setInput } = loadingFixture(t);
  await manager.Ready(resource);
  setInput("invalid JSON");
  resource.Reload();
  await assert.rejects(manager.Ready(resource));
  assert.deepEqual(calls.map(call => call[0]), ["rebuild", "release", "release"]);
  assert.equal(owner.resource, resource);
  setInput("{}");
  resource.Reload();
  await manager.Ready(resource);
  assert.deepEqual(calls.map(call => call[0]), ["rebuild", "release", "release", "release", "rebuild"]);
});

test("manager resource purge clears live owner slots before shutting down the resource", async t =>
{
  const { manager, resource, owner, calls } = loadingFixture(t);
  await manager.Ready(resource);
  manager.leaseSeconds = 1000000;
  const shutdown = resource._OnShutdown;
  let releasedBeforeShutdown = false;
  resource._OnShutdown = function(options)
  {
    releasedBeforeShutdown = owner.resource === null && manager.notify.GetByResource(this).length === 0;
    return shutdown.call(this, options);
  };
  manager.PurgeInactive({ maxIdleFrames: 0, maxIdleMilliseconds: 0 });
  assert.equal(releasedBeforeShutdown, true);
  assert.equal(owner.resource, null);
  assert.deepEqual(calls.map(call => call[0]), ["rebuild", "remove"]);
  assert.equal(manager.GetResourceStatus(resource).purged, true);
});

test("IsGood renews each owner dependency even when an earlier dependency is bad", t =>
{
  const previous = blue.resMan;
  const { manager, resource, owner, advance } = fixture();
  blue.resMan = manager;
  t.after(() => { try { manager.Clear(); } finally { blue.resMan = previous; } });
  const other = new BlueAsyncRes();
  owner.other = other;
  other._SetGood(true);
  manager.notify.Add(owner, resource, owner, "resource");
  manager.notify.Add(owner, other, owner, "other");
  advance(900);
  let good = true;
  if (!resource.IsGood(owner)) good = false;
  if (!other.IsGood(owner)) good = false;
  assert.equal(good, false);
  assert.deepEqual(manager.notify.GetByOwner(owner).map(link => link.lastUsed), [900, 900]);
  advance(1100);
  manager.PurgeInactive({ time: 1100 });
  assert.equal(owner.resource, resource);
  assert.equal(owner.other, other);
});

test("map links expire by key and preserve replacements installed before or while letting go", () =>
{
  const { manager, resource, advance } = fixture();
  const calls = [];
  const replacement = new BlueAsyncRes();
  const map = new Map([["first", resource], ["second", resource]]);
  const owner = holder(calls, {}, [ map ]);
  manager.notify.Add(owner, resource, map, "first");
  manager.notify.Add(owner, resource, map, "second");
  map.set("first", replacement);
  owner.RemoveCachedData = value => { calls.push(["remove", value]); map.set("second", replacement); };
  advance(1100);
  manager.PurgeInactive({ time: 1100 });
  assert.equal(map.get("first"), replacement);
  assert.equal(map.get("second"), replacement);
  assert.deepEqual(calls, [["remove", resource]]);
  assert.equal(manager.notify.GetByOwner(owner).length, 0);

  const third = holder([], {}, [ map ]);
  map.set("third", resource);
  manager.notify.Add(third, resource, map, "third");
  advance(2200);
  manager.PurgeInactive({ time: 2200 });
  assert.equal(map.has("third"), true, "expiry never drops a path");
  assert.equal(map.get("third"), null);
});

test("expiry removes the failing owner's link and propagates its error immediately", () =>
{
  const { manager, resource, owner, advance } = fixture();
  const second = new BlueAsyncRes();
  const other = holder([], { resource: second });
  const third = new BlueAsyncRes();
  const last = holder([], { resource: third });
  const failure = new Error("first failed");
  owner.RemoveCachedData = () => { throw failure; };
  manager.notify.Add(owner, resource, owner, "resource");
  manager.notify.Add(other, second, other, "resource");
  manager.notify.Add(last, third, last, "resource");
  advance(1100);

  assert.throws(() => manager.notify.Update(1100), error => error === failure);
  assert.equal(owner.resource, resource, "nothing clears a slot for its owner");
  assert.equal(other.resource, second);
  assert.equal(last.resource, third, "later callbacks have not run");
  assert.deepEqual(manager.notify.GetByOwner(owner), []);
  manager.notify.Update(1100);
  assert.equal(other.resource, null);
  assert.equal(last.resource, null);
  assert.equal(manager.notify._targets.length, 0, "a later successful sweep compacts inactive links");
  assert.equal(manager.notify._targetsByResource.size, 0);
});

test("Clear propagates a callback failure directly after removing its link", () =>
{
  const { manager, resource, owner } = fixture();
  const other = holder([], { resource });
  const failure = new Error("failed");
  owner.RemoveCachedData = () => { throw failure; };
  manager.notify.Add(owner, resource, owner, "resource");
  manager.notify.Add(other, resource, other, "resource");

  assert.throws(() => manager.notify.Clear(resource), error => error === failure);
  assert.equal(other.resource, resource);
  assert.deepEqual(manager.notify.GetByOwner(owner), []);
  manager.notify.Clear(resource);
  assert.equal(other.resource, null);
  assert.equal(manager.notify.GetByResource(resource).length, 0);
});

test("the resource index follows Add and Remove, and dispatch reaches only that resource's owners", () =>
{
  const { manager, resource, owner, calls } = fixture();
  const unrelated = new BlueAsyncRes();
  const bystander = {
    resource: unrelated,
    RebuildCachedData() { throw new Error("wrong resource"); },
    ReleaseCachedData() { throw new Error("wrong resource"); },
    RemoveCachedData() { throw new Error("wrong resource"); }
  };
  manager.notify.Add(owner, resource, owner, "resource");
  manager.notify.Add(bystander, unrelated, bystander, "resource");
  assert.equal(manager.notify._targetsByResource.get(resource).length, 1);

  manager.notify.RebuildCachedData(resource);
  manager.notify.ReleaseCachedData(resource);
  assert.deepEqual(calls.map(call => call[0]), [ "rebuild", "release" ]);

  manager.notify.Remove(owner, resource);
  assert.equal(manager.notify._targetsByResource.has(resource), false);
  assert.equal(manager.notify.GetByResource(resource).length, 0);
  assert.equal(manager.notify.GetByResource(unrelated).length, 1);
});

test("link expiry falls back to the policy, then the default when sweeping is off", () =>
{
  const { manager } = fixture();
  manager.linkExpirySeconds = null;
  assert.equal(manager.GetLinkExpirySeconds(), BlueResMan.defaultAutoPurgePolicy.maxIdleMilliseconds / 1000);
  manager.SetAutoPurgePolicy({ maxIdleMilliseconds: 2000 });
  assert.equal(manager.GetLinkExpirySeconds(), 2);
  manager.linkExpirySeconds = 5;
  assert.equal(manager.GetLinkExpirySeconds(), 5);
});

test("notify.Remove for a link that does not exist is a harmless no-op", () =>
{
  const { manager, resource, owner } = fixture();
  const stranger = new BlueAsyncRes();
  manager.notify.Add(owner, resource, owner, "resource");
  manager.notify.Remove(owner, stranger);
  manager.notify.Remove({}, resource);
  manager.notify.Remove(owner, null);
  assert.equal(manager.notify.GetByOwner(owner).length, 1, "the real link is untouched");
  manager.notify.Remove(owner, resource);
  manager.notify.Remove(owner, resource);
  assert.equal(manager.notify.GetByOwner(owner).length, 0, "removing twice is harmless");
});

test("a holder's RemoveCachedData does the whole release: data, slots and link; Destruct uses it", async () =>
{
  const { Tr2Mesh } = await import("../../../npm/dist/trinity/core/mesh/Tr2Mesh.js");
  const { Tr2GrannyTrack } = await import("../../../npm/dist/trinity/curves/track/Tr2GrannyTrack.js");
  const { TriGeometryRes } = await import("../../../npm/dist/trinity/resources/geometry/TriGeometryRes.js");
  const notify = blue.resMan.notify;
  const geometry = new TriGeometryRes(), lowRes = new TriGeometryRes();
  const mesh = new Tr2Mesh();
  mesh.SetGeometryRes(geometry);
  mesh.SetLowResGeometryRes(lowRes);
  assert.equal(notify.GetByOwner(mesh).length, 2);
  mesh.RemoveCachedData(geometry);
  assert.equal(mesh.geometry, null);
  assert.deepEqual(notify.GetByOwner(mesh).map(link => link.key), [ "lowResGeometry" ], "only the released resource is unlinked");
  mesh.Destruct();
  assert.equal(mesh.lowResGeometry, null);
  assert.equal(notify.GetByOwner(mesh).length, 0, "Destruct releases what is left through RemoveCachedData");
  const track = new Tr2GrannyTrack();
  let released = 0;
  track.ReleaseCachedData = () => { released++; };
  track.grannyRes = geometry;
  notify.Add(track, geometry, track, "grannyRes");
  track.Destruct();
  assert.equal(released, 1, "Destruct releases through RemoveCachedData");
  assert.equal(notify.GetByOwner(track).length, 0);
});

test("a notify target without its own RemoveCachedData gets the generated not-implemented error", async () =>
{
  const { IBlueAsyncResNotifyTarget } = await import("../../../npm/dist/blue/interfaces/IBlueAsyncResNotifyTarget.js");
  class Partial extends IBlueAsyncResNotifyTarget {}
  assert.throws(() => new Partial().RemoveCachedData(new BlueAsyncRes()), /IBlueAsyncResNotifyTarget\.RemoveCachedData\(resource\) must be implemented/);
});
