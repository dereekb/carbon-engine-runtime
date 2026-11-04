// CjsTrinity: Carbon's registry, the scene-content sweep, SetDevice, Initialize
// and Shutdown (docs internal/decisions/device-resource-registration.md, Revised
// lifecycle). Registering keeps one entry; UnregisterResource destructs; the
// sweep, run every sweep interval of Blue frame time, releases what is unused
// past the one rule and drops stale entries; the device is handed in and
// replaced only through SetDevice.
import assert from "node:assert/strict";
import test, { beforeEach, afterEach } from "node:test";

import { blue } from "../../npm/dist/blue/index.js";
import { CjsTrinity, trinity, TriDevice, TriStorageFlags } from "../../npm/dist/index.js";
import { Tr2RenderContextALStub } from "../../npm/dist/trinityal/index.js";
import { CjsLibrary } from "../../npm/dist/core/index.js";

let previousResources, previousGenerations;
beforeEach(() => {
  previousResources = TriDevice._resourcesRegistered;
  previousGenerations = TriDevice._registeredGenerations;
  TriDevice._resourcesRegistered = [];
  TriDevice._registeredGenerations = [];
});
afterEach(() => {
  TriDevice._resourcesRegistered = previousResources;
  TriDevice._registeredGenerations = previousGenerations;
});

/**
 * A stand-in device resource that counts its releases.
 *
 * @param {string} name A label for failures.
 * @returns {object} The resource.
 */
function resource(name)
{
  return { name, releases: 0, ReleaseResources() { this.releases++; } };
}

/**
 * A stand-in device that records what Trinity asks of it.
 *
 * @returns {object} The device.
 */
function device()
{
  return {
    prepared: 0, released: [], ticks: 0,
    PrepareDeviceResources() { this.prepared++; },
    ReleaseDeviceResources(storage) { this.released.push(storage); },
    OnTick() { this.ticks++; }
  };
}

test("Carbon's registry: registering twice keeps one entry, before any device", () =>
{
  const holder = new CjsTrinity();
  const r = resource("r");
  holder.RegisterResource(r);
  holder.RegisterResource(r);
  assert.equal(holder.device, null);
  assert.deepEqual(holder.GetResourcesRegistered(), [ r ]);
  assert.equal(Object.hasOwn(holder, "_resourcesRegistered"), false);
  assert.deepEqual(TriDevice.GetResourcesRegistered(), [ r ]);
  const active = new TriDevice();
  assert.deepEqual(active.GetResourcesRegistered(), [ r ]);
  active.UnregisterResource(r);
  assert.deepEqual(holder.GetResourcesRegistered(), []);
});

test("SetDevice: the same device again does nothing", () =>
{
  const holder = new CjsTrinity();
  const d = device();
  holder.SetDevice(d);
  holder.SetDevice(d);
  assert.equal(d.prepared, 1);
  assert.deepEqual(d.released, []);
});

test("SetDevice: a swap releases from the old device, then prepares on the new", () =>
{
  const holder = new CjsTrinity();
  const order = [];
  const first = device(), second = device();
  first.ReleaseDeviceResources = storage => order.push([ "release first", storage, holder.device === first ]);
  second.PrepareDeviceResources = () => order.push([ "prepare second", holder.device === second ]);
  holder.SetDevice(first);
  holder.SetDevice(second);
  assert.deepEqual(order, [ [ "release first", TriStorageFlags.TRISTORAGE_ALL, true ], [ "prepare second", true ] ]);
  assert.equal(holder.device, second);
});

test("SetDevice(null) throws: clearing is Shutdown's", () =>
{
  const holder = new CjsTrinity();
  assert.throws(() => holder.SetDevice(null), /Shutdown clears it/);
});

test("Initialize needs a device and runs Trinity's start-up once", () =>
{
  const holder = new CjsTrinity();
  const renderer = { started: 0, initialize() { this.started++; } };
  const fontManager = {};
  assert.throws(() => holder.Initialize({ fontManager, renderer }), /no device backend chosen/);
  const d = device();
  holder.Initialize({ device: d, fontManager, renderer });
  for (const name of [ "BlitOriginal", "BlitCurrent", "g_texelSize" ]) assert.ok(holder.variableStore.FindVariable(name), `${name} is registered`);
  assert.equal(renderer.started, 1);
  assert.equal(holder.fontManager, fontManager);
  assert.equal(holder.device, d);
  assert.equal(d.prepared, 1, "what is already registered is prepared");
  assert.equal(blue.os.IsRegisteredForTicks(holder), true);
  assert.throws(() => holder.Initialize({ device: device(), fontManager, renderer }), /already initialized/);
  holder.Shutdown();
  assert.equal(blue.os.IsRegisteredForTicks(holder), false);
  assert.deepEqual(d.released, [ TriStorageFlags.TRISTORAGE_ALL ]);
  assert.equal(holder.device, null);
});

test("CjsLibrary builds the device for the host's abstraction layer and starts trinity", async () =>
{
  assert.equal(trinity.device, null, "no device until the host chooses a backend");
  const library = new CjsLibrary();
  await library.Initialize();
  try
  {
    assert.throws(() => library.AttachTrinity({}), /no device backend chosen/);
    const built = library.AttachTrinity({ renderContextAL: new Tr2RenderContextALStub() });
    assert.equal(trinity.device, built);
    assert.ok(trinity.fontManager);
    assert.ok(trinity.variableStore.FindVariable("Time"), "the renderer's globals are registered");
    const rule = trinity.resourceIdleRule, interval = trinity.resourceSweepInterval;
    library.SetConfiguration({ deviceResources: { idleRule: 5, sweepInterval: 20 } });
    assert.deepEqual([ trinity.resourceIdleRule, trinity.resourceSweepInterval ], [ 5, 20 ], "deviceResources configures the sweep");
    assert.throws(() => library.SetConfiguration({ deviceResources: { idleRule: -1 } }), /Invalid configuration entry/);
    trinity.resourceIdleRule = rule;
    trinity.resourceSweepInterval = interval;
  }
  finally
  {
    await library.Shutdown();
  }
  assert.equal(trinity.device, null, "Shutdown stops what AttachTrinity started");
  assert.equal(trinity.fontManager, null);
});
