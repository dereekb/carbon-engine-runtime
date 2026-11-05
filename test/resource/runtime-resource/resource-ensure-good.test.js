import assert from "node:assert/strict";
import { test } from "node:test";
import { BlueAsyncRes, BlueResMan, blue } from "../../../npm/dist/blue/index.js";
import { RegisterDataLoader } from "../../support/testDataRes.js";
import "../../support/frameLoop.js";

/** A manager installed as Blue's, serving one data extension through a test Res class. */
function manager(t, loader = bytes => bytes.length)
{
  const previous = blue.resMan;
  const resMan = new BlueResMan({ source: { Read: () => new Uint8Array([ 1, 2, 3 ]) } });
  blue.resMan = resMan;
  t.after(() => { try { resMan.Clear(); } finally { blue.resMan = previous; } });
  RegisterDataLoader(resMan, "bin", loader);
  return resMan;
}

test("IsGood renews the resource and answers IsGood", async t =>
{
  const resMan = manager(t);
  const resource = await resMan.FetchResource("res:/ensure/good.bin");
  let renewed = 0;
  const keepAlive = resource.KeepAlive;
  resource.KeepAlive = function (...args) { renewed++; return keepAlive.apply(this, args); };

  assert.equal(resource.IsGood(), true);
  assert.ok(renewed >= 1, "IsGood renews");
  resource._isGood = false;
  assert.equal(resource.IsGood(), false);
});

test("IsGood and its exposed property renew; manager status inspection does not", async t =>
{
  const resMan = manager(t);
  const resource = await resMan.FetchResource("res:/ensure/renew.bin");
  let renewed = 0;
  resource.KeepAlive = () => { renewed++; };
  resMan.GetResourceStatus(resource);
  assert.equal(renewed, 0);
  assert.equal(resource.isGood, true);
  assert.equal(renewed, 1);
  assert.equal(resource.IsGood(), true);
  assert.equal(renewed, 2);
});
