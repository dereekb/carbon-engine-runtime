import assert from "node:assert/strict";
import { test } from "node:test";
import { BlueAsyncRes, BlueResMan, MotherLode, blue } from "../../../npm/dist/blue/index.js";
import { RegisterDataLoader } from "../../support/testDataRes.js";
import "../../support/frameLoop.js";

/** A manager with deterministic milliseconds, without network or loading work. */
function fixture()
{
  let time = 0;
  const manager = new BlueResMan({ motherLode: new MotherLode({ now: () => time }), autoPurgePolicy: false });
  manager.leaseSeconds = 1;
  const resource = new BlueAsyncRes();
  const calls = [];
  const owner = {
    resource,
    RebuildCachedData(value) { calls.push(["rebuild", value]); },
    ReleaseCachedData(value) { calls.push(["release", value]); }
  };
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
  assert.deepEqual(first.calls, [["release", resource]]);
  assert.equal(first.manager.notify.GetByResource(resource).length, 0);
  assert.equal(second.owner.resource, resource);
  assert.equal(second.manager.notify.GetByResource(resource).length, 1);
  assert.deepEqual(second.calls, []);

  first.owner.resource = resource;
  first.manager.notify.Add(first.owner, resource, first.owner, "resource");
  first.manager.notify.RebuildCachedData(resource);
  assert.deepEqual(first.calls, [["release", resource], ["rebuild", resource]]);
  assert.deepEqual(second.calls, []);
  first.manager.Clear();
  second.manager.Clear();
});

test("notify.Update reads its owner's current clock and lease policy", () =>
{
  const { manager, resource, owner, advance } = fixture();
  manager.notify.Add(owner, resource, owner, "resource");
  advance(1100);
  manager.leaseSeconds = 2;
  manager.notify.Update();
  assert.equal(owner.resource, resource);

  manager.leaseSeconds = null;
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

test("waiting owners rebuild on completion and notification tolerates setter removal", () =>
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

test("lease renewal is per owner; expiry calls the accessor and preserves a busy peer", () =>
{
  const state = fixture();
  const { manager, resource, owner, calls } = state;
  let held = resource;
  let assigned = 0;
  Object.defineProperty(owner, "resource", {
    get() { return held; },
    set(value) { assigned++; manager.notify.Remove(owner, held); held = value; }
  });
  const peer = { resource, RebuildCachedData() {}, ReleaseCachedData() { throw new Error("renewed peer expired"); } };
  manager.notify.Add(owner, resource, owner, "resource");
  manager.notify.Add(peer, resource, peer, "resource");
  state.advance(900);
  assert.equal(manager.notify.KeepAlive(peer, resource), true);
  state.advance(1100);
  manager.PurgeInactive({ time: 1100 });
  assert.deepEqual(calls, [["release", resource]]);
  assert.equal(assigned, 1);
  assert.equal(owner.resource, null);
  assert.equal(peer.resource, resource);
  assert.equal(manager.notify.GetByResource(resource).length, 1);
  assert.equal(manager.notify.KeepAlive(owner, resource), false);
});

test("expiry never clears a replacement, including one installed by the release callback", () =>
{
  const state = fixture();
  const { manager, resource, owner, calls } = state;
  const replacement = new BlueAsyncRes();
  manager.notify.Add(owner, resource, owner, "resource");
  owner.resource = replacement;
  state.advance(1100);
  manager.PurgeInactive({ time: 1100 });
  assert.equal(owner.resource, replacement);
  assert.equal(calls.length, 0);
  assert.equal(manager.notify.GetByOwner(owner).length, 0);

  owner.resource = resource;
  owner.ReleaseCachedData = () => { owner.resource = replacement; };
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
  assert.deepEqual(calls, [["release", resource]]);
  owner.resource = resource;
  manager.notify.Add(owner, resource, owner, "resource");
  manager.notify.RebuildCachedData(resource);
  assert.deepEqual(calls.map(call => call[0]), ["release", "rebuild"]);
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
  assert.deepEqual(calls, [["release", resource]]);
  assert.equal(manager.notify.GetByOwner(owner).length, 1);
});

test("two owner properties sharing one resource release once and both clear despite setter removal", () =>
{
  const { manager, resource, owner, calls } = fixture();
  let first = resource;
  Object.defineProperty(owner, "resource", {
    get() { return first; },
    set(value) { manager.notify.Remove(owner, first); first = value; }
  });
  owner.other = resource;
  manager.notify.Add(owner, resource, owner, "resource");
  manager.notify.Add(owner, resource, owner, "other");
  manager.notify.Clear(resource);
  assert.equal(owner.resource, null);
  assert.equal(owner.other, null);
  assert.deepEqual(calls, [["release", resource]]);
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
  const owner = {
    resource,
    RebuildCachedData(value) { calls.push(["rebuild", value]); },
    ReleaseCachedData(value) { calls.push(["release", value]); }
  };
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
  assert.deepEqual(calls.map(call => call[0]), ["rebuild", "release"]);
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

test("map links expire by key and preserve replacements installed before or during cleanup", () =>
{
  const { manager, resource, owner, calls, advance } = fixture();
  const replacement = new BlueAsyncRes();
  const holder = new Map([["first", resource], ["second", resource]]);
  manager.notify.Add(owner, resource, holder, "first");
  manager.notify.Add(owner, resource, holder, "second");
  holder.set("first", replacement);
  owner.ReleaseCachedData = value => { calls.push(["release", value]); holder.set("second", replacement); };
  advance(1100);
  manager.PurgeInactive({ time: 1100 });
  assert.equal(holder.get("first"), replacement);
  assert.equal(holder.get("second"), replacement);
  assert.deepEqual(calls, [["release", resource]]);
  assert.equal(manager.notify.GetByOwner(owner).length, 0);

  holder.set("third", resource);
  manager.notify.Add(owner, resource, holder, "third");
  advance(2200);
  manager.PurgeInactive({ time: 2200 });
  assert.equal(holder.has("third"), false);
});
