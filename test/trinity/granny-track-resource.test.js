import assert from "node:assert/strict";
import { test } from "node:test";
import { blue, BlueResMan, MotherLode } from "../../npm/dist/blue/index.js";
import { TriGrannyRes } from "../../npm/dist/resource/index.js";
import { CjsGrannyCurves } from "../../npm/dist/trinity/curves/track/CjsGrannyCurves.js";
import { Tr2GrannyVectorTrack } from "../../npm/dist/trinity/curves/track/Tr2GrannyVectorTrack.js";

const PATH = "res:/track/fixture.gr2";

/** One group holding one scalar track, in the decoded shape the tracks read. */
function grannyFile()
{
  return {
    animations: [ {
      name: "Clip",
      duration: 10,
      timeStep: 1,
      trackGroups: [ {
        name: "root",
        vectorTracks: [ {
          name: "Alpha",
          valueCurve: { format: 0, degree: 0, dimension: 1, controls: [ 10, 20, 30, 40 ] }
        } ]
      } ]
    } ]
  };
}

/** A manager with a deterministic clock that answers one TriGrannyRes by path. */
function harness(t)
{
  const previous = blue.resMan;
  let time = 1000;
  const manager = blue.resMan = new BlueResMan({ motherLode: new MotherLode({ now: () => time }), autoPurgePolicy: false });
  manager.linkExpirySeconds = 1;

  const resource = new TriGrannyRes();
  resource._path = PATH;
  resource._ext = "raw";
  const requests = [];
  manager.GetResource = (path, options = {}) =>
  {
    requests.push([ path, options.ex ?? "" ]);
    return resource;
  };

  CjsGrannyCurves.clearResources();
  t.after(() => { blue.resMan = previous; });

  return {
    manager,
    resource,
    requests,
    finish()
    {
      resource._grannyFile = grannyFile();
      resource._SetPrepared(true);
      resource._SetGood(true);
      resource._NotifyRebuildCachedData();
    },
    advance(milliseconds)
    {
      time += milliseconds;
      manager.activityTime = time;
      manager.PurgeInactive({ time });
    }
  };
}

function track()
{
  const result = new Tr2GrannyVectorTrack();
  result.grannyResPath = PATH;
  result.group = "root";
  result.name = "Alpha";
  return result;
}

test("a track asks resMan for the raw resource and binds when it arrives", t =>
{
  const run = harness(t);
  const value = track();
  value.Initialize();

  assert.deepEqual(run.requests, [ [ PATH, "raw" ] ], "Tr2GrannyTrack.cpp:96");
  assert.equal(value.grannyRes, run.resource);
  assert.equal(value.TracksReady(), false, "nothing to bind from yet");
  assert.equal(run.manager.notify.GetByOwner(value).length, 1);

  run.finish();
  assert.equal(value.TracksReady(), true, "the notification binds the tracks");
  assert.equal(value.Length(), 10);
  value.Destruct();
});

test("a release drops the tracks and a rebuild binds them again", t =>
{
  const run = harness(t);
  const value = track();
  value.Initialize();
  run.finish();

  run.resource._NotifyReleaseCachedData();
  assert.equal(value.TracksReady(), false);
  assert.equal(value.Length(), 0);
  assert.equal(value.grannyRes, run.resource, "a reload keeps the resource");

  run.resource._NotifyRebuildCachedData();
  assert.equal(value.TracksReady(), true);
  value.Destruct();
});

test("a track that stops updating recovers at use with its path unchanged", t =>
{
  const run = harness(t);
  const value = track();
  value.Initialize();
  run.finish();

  run.advance(5000);
  assert.equal(value.grannyRes, null);
  assert.equal(value.grannyResPath, PATH, "expiry keeps the path");
  assert.equal(value.TracksReady(), false);

  value.UpdateValue(5);
  assert.equal(value.grannyRes, run.resource);
  assert.equal(value.TracksReady(), true);
  assert.equal(run.requests.length, 2);
  value.Destruct();
});

test("continued use renews the link", t =>
{
  const run = harness(t);
  const value = track();
  value.Initialize();
  run.finish();

  for (let index = 0; index < 4; index++)
  {
    value.UpdateValue(1);
    run.advance(600);
  }

  assert.equal(value.grannyRes, run.resource);
  value.Destruct();
});

test("clearing the path unlinks, and Destruct stops any reload", t =>
{
  const run = harness(t);
  const value = track();
  value.Initialize();
  run.finish();

  value.grannyResPath = "";
  value.SetGrannyResource();
  assert.equal(value.grannyRes, null);
  assert.equal(value.Length(), 0);
  assert.equal(run.manager.notify.GetByOwner(value).length, 0);

  value.grannyResPath = PATH;
  value.Initialize();
  value.Destruct();
  assert.equal(run.manager.notify.GetByOwner(value).length, 0);

  const count = run.requests.length;
  value.UpdateValue(1);
  assert.equal(run.requests.length, count);
});
