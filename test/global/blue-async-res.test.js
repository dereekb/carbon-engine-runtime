import assert from "node:assert/strict";
import test from "node:test";
import { CjsSchema } from "../../npm/dist/blue/schema/index.js";
import {
  blue, BlueAsyncRes, BlueResMan, BlueResManQueue, IBlueAsyncResNotifyTarget, IBlueCallbackMan, IBlueResMan, IBluePaths, IBlueResource
} from "../../npm/dist/blue/index.js";
import "../support/frameLoop.js";

/** Records queued callbacks so a test can run them as the queue would. */
class QueueResMan extends BlueResMan
{
  queued = [];
  rebuilds = [];
  releases = [];
  cancelled = [];
  reserved = [];
  released = [];
  urgent = false;
  mainThread = true;
  nextId = 1;

  AddToQueue(queue, callback, context, flags)
  {
    const id = this.nextId++;
    this.queued.push({ id, queue, callback, context, flags });
    return id;
  }

  CancelFromQueue(queue, id) { this.cancelled.push({ queue, id }); }
  IsUrgentResourceLoads() { return this.urgent; }
  IsOnMainThread() { return this.mainThread; }
  ReserveBackgroundLoadMemory(size) { this.reserved.push(size); }
  ReleaseBackgroundLoadMemory(size) { this.released.push(size); }

  /** Runs a queued entry as BlueCallbackMan does: `callback(context)` (IBlueCallbackMan.h:12). */
  Run(entry) { return entry.callback(entry.context); }
}

class MapPaths extends IBluePaths
{
  files = new Map();
  requested = [];
  async GetStreamFromPath(path) { this.requested.push(path); return this.files.get(path) ?? null; }
}

class TestRes extends BlueAsyncRes
{
  loadResult = BlueAsyncRes.LoadingResult.LR_SUCCESS;
  prepareResult = true;
  loadedBytes = null;
  cleanups = 0;
  _DoLoad() { this.loadedBytes = this._dataStream.data; return this.loadResult; }
  _DoPrepare() { return this.prepareResult; }
  _CleanupLoadData() { this.cleanups += 1; }
}

class Target extends IBlueAsyncResNotifyTarget
{
  calls = [];
  RebuildCachedData(resource) { this.calls.push([ "rebuild", resource ]); }
  ReleaseCachedData(resource) { this.calls.push([ "release", resource ]); }
}

function setup(t)
{
  const previous = { resMan: blue.resMan, paths: blue.paths };
  const resMan = new QueueResMan(), paths = new MapPaths();
  const notify = resMan.notify;
  const release = notify.ReleaseCachedData;
  const rebuild = notify.RebuildCachedData;
  t.mock.method(notify, "ReleaseCachedData", resource =>
  {
    resMan.releases.push(resource);
    release.call(notify, resource);
  });
  t.mock.method(notify, "RebuildCachedData", resource =>
  {
    resMan.rebuilds.push(resource);
    rebuild.call(notify, resource);
  });
  blue.resMan = resMan;
  blue.paths = paths;
  t.after(() => { blue.resMan = previous.resMan; blue.paths = previous.paths; });
  return { resMan, paths };
}

test("BlueAsyncRes registers Carbon's exposure block", () =>
{
  assert.equal(CjsSchema.getClassName(BlueAsyncRes), "BlueAsyncRes");
  assert.equal(CjsSchema.cast(new TestRes(), IBlueResource) !== null, true);
  const members = CjsSchema.getSchema(BlueAsyncRes).members;
  for (const [ key, name ] of [ [ "_path", "path" ], [ "_ext", "ext" ] ])
  {
    const member = members.find(entry => entry.key === key);
    assert.equal(member.name, name, key);
    assert.equal(member.exposure.macro, "MAP_ATTRIBUTE", key);
    assert.equal(member.edit.read, true, key);
  }
  for (const name of [ "isGood", "isPrepared", "isLoading" ])
  {
    assert.equal(CjsSchema.getField(BlueAsyncRes, name).exposure.macro, "MAP_PROPERTY_READONLY", name);
  }
  for (const name of [ "IsLoading", "IsPrepared", "IsGood", "Reload" ])
  {
    assert.equal(CjsSchema.getMethod(BlueAsyncRes, name).exposure.macro, "MAP_METHOD_AND_WRAP", name);
  }
});

test("Initialize parses the query and queues the load on the background queue", t =>
{
  const { resMan } = setup(t);
  resMan.urgent = true;
  const res = new TestRes();
  res.Initialize("res:/a/b.dds?size=64&srgb", "");

  assert.equal(res.GetPath(), "res:/a/b.dds?size=64&srgb");
  assert.equal(res.GetFilePath(), "res:/a/b.dds");
  assert.equal(res.GetQuery(), "size=64&srgb");
  assert.deepEqual(res._FindFirstQueryArgumentByName("size"), [ "size", "64" ]);
  assert.deepEqual(res._FindFirstQueryArgumentByName("srgb"), [ "srgb", "" ]);
  assert.equal(res._FindFirstQueryArgumentByName("missing"), null);

  assert.equal(res.IsLoading(), true);
  assert.equal(resMan.queued.length, 1);
  assert.equal(resMan.queued[0].queue, BlueResManQueue.BRMQ_BACKGROUND);
  assert.equal(resMan.queued[0].flags, IBlueCallbackMan.BCBF_URGENT);
  assert.equal(res._loadCbId, resMan.queued[0].id);
});

test("a successful load opens the file without its query, prepares and notifies", async t =>
{
  const { resMan, paths } = setup(t);
  paths.files.set("res:/a.bin", { form: "bytes", data: new Uint8Array(12) });
  const res = new TestRes(), target = new Target();
  target.resource = res;
  resMan.notify.Add(target, res, target, "resource");
  res.Initialize("res:/a.bin?q=1", "");

  await resMan.Run(resMan.queued[0]);
  assert.equal(res.IsPrepared(), false);
  resMan.Run(resMan.queued[1]);

  assert.deepEqual(paths.requested, [ "res:/a.bin" ]);
  assert.equal(res.loadedBytes.byteLength, 12);
  assert.deepEqual(resMan.reserved, [ 12 ]);
  assert.deepEqual(resMan.released, [ 12 ]);
  assert.equal(res._dataStream, null);
  assert.equal(res.IsPrepared(), true);
  assert.equal(res.IsGood(), true);
  assert.equal(res.IsLoading(), false);
  assert.equal(res._loadCbId, 0);
  assert.equal(resMan.rebuilds.filter(value => value === res).length, 1);
  assert.deepEqual(target.calls, [ [ "rebuild", res ] ], "completion reaches the registered owner without polling");
});

test("a data stream loads through the global manager without a new memory budget", async t =>
{
  const { paths } = setup(t);
  const resMan = new BlueResMan();
  blue.resMan = resMan;
  const bytes = new Uint8Array([ 1, 2, 3 ]);
  paths.files.set("res:/budget.bin", { form: "bytes", data: bytes });
  const res = new TestRes();
  res.Initialize("res:/budget.bin", "");
  await resMan.Ready(res);
  assert.equal(res.loadedBytes, bytes);
  assert.equal(res.IsGood(), true);
  assert.equal(res.IsLoading(), false);
  assert.equal(res._dataStream, null);
  assert.equal(res._reservedMemory, 0);
  assert.equal(res.IsPrepared(), true);
  for (const method of [ "ReserveBackgroundLoadMemory", "ReleaseBackgroundLoadMemory" ])
    assert.equal(CjsSchema.getMethod(BlueResMan, method).impl.status, "noop");
});

test("prepare is budgeted on the logical main queue; DONTNOTIFY is not a change", async t =>
{
  const { resMan, paths } = setup(t);
  resMan.mainThread = false;
  paths.files.set("res:/a.bin", { form: "bytes", data: new Uint8Array(4) });
  const res = new TestRes();
  res.loadResult = BlueAsyncRes.LoadingResult.LR_SUCCESS_DONTNOTIFY;
  res.Initialize("res:/a.bin", "");

  await resMan.Run(resMan.queued[0]);
  assert.equal(resMan.queued[1].queue, BlueResManQueue.BRMQ_MAIN);
  assert.equal(res._prepareCbId, resMan.queued[1].id);
  assert.equal(res.IsPrepared(), false);

  resMan.Run(resMan.queued[1]);
  assert.equal(res.IsPrepared(), true);
  assert.equal(res.IsGood(), true);
  assert.equal(res._prepareCbId, 0);
  assert.equal(resMan.rebuilds.filter(value => value === res).length, 0);
});

test("a missing file queues the failure notice and releases cached data", async t =>
{
  const { resMan } = setup(t);
  const res = new TestRes();
  res.Initialize("res:/missing.bin", "");

  await resMan.Run(resMan.queued[0]);
  assert.equal(resMan.queued[1].queue, BlueResManQueue.BRMQ_MAIN);
  resMan.Run(resMan.queued[1]);

  assert.equal(res.IsPrepared(), true);
  assert.equal(res.IsGood(), false);
  assert.equal(res.IsLoading(), false);
  assert.equal(res._loadSucceeded, false);
  assert.equal(res.cleanups, 1);
  assert.equal(resMan.rebuilds.filter(value => value === res).length, 0);
  assert.equal(resMan.releases.filter(value => value === res).length, 1);
});

test("Reload cancels and queues a fresh load; starting it is not a change", t =>
{
  const { resMan } = setup(t);
  const res = new TestRes();
  res.Initialize("res:/a.bin", "ddsraw");
  const firstId = res._loadCbId;

  res.Reload();

  assert.deepEqual(resMan.cancelled, [ { queue: BlueResManQueue.BRMQ_BACKGROUND, id: firstId } ]);
  assert.equal(resMan.rebuilds.length, 0);
  assert.equal(resMan.queued.length, 2);
  assert.equal(res.GetExt(), "ddsraw");
  assert.equal(res._loadCbId, resMan.queued[1].id);
});

test("owners register directly with resMan.notify without manager forwarding methods", t =>
{
  const { resMan } = setup(t);
  const res = new TestRes(), target = new Target();
  target.resource = res;
  resMan.notify.Add(target, res, target, "resource");
  res._NotifyRebuildCachedData();
  assert.deepEqual(target.calls, [["rebuild", res]]);
  resMan.notify.Remove(target, res);
  res._NotifyReleaseCachedData();
  assert.equal(target.calls.length, 1);
  assert.equal("AddNotifyTarget" in resMan, false);
  assert.equal("_NotifyRebuildCachedData" in resMan, false);
});
