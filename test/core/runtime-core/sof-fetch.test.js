import assert from "node:assert/strict";
import test from "node:test";
import { CjsLibrary } from "../../../npm/dist/core/CjsLibrary.js";
import { blue } from "../../../npm/dist/blue/index.js";
import { CjsSchema } from "../../../npm/dist/blue/schema/index.js";
import { EveShip2 } from "../../../npm/dist/trinity/eve/spaceObject/EveShip2.js";

test("library routes DNA itself, hydrates its emitted type and preserves resource requests", async t =>
{
  const library = new CjsLibrary();
  t.after(() => library.Shutdown());
  const options = { privateOption: {} }, calls = [];
  const sof = { BuildFromDNA(dna, received)
  {
    calls.push([dna, received]);
    return { _type: "Tr2FloatParameter", name: "value", value: 7 };
  } };
  await library.Initialize({ sof });
  t.mock.method(blue, "Fetch", () => assert.fail("library owns routing"));
  for (const dna of ["h:f:r", "h:f:r:layout?test"])
  {
    const object = await library.Fetch(dna, options);
    assert.equal(CjsSchema.getClassName(object.constructor), "Tr2FloatParameter");
    assert.equal(object.value, 7);
    assert.deepEqual(calls.pop(), [dna, options]);
  }

  const resource = {};
  t.mock.method(blue.resMan, "Fetch", (path, received) =>
  {
    calls.push([path, received]);
    return resource;
  });
  for (const path of ["res:/a:b:c.black", "res:\\a:b:c.black", "https://example.invalid/a:b", "h:f"])
  {
    assert.equal(await library.Fetch(path, options), resource);
    assert.deepEqual(calls.pop(), [path, options]);
  }
});

test("library preserves null builds and propagates SOF and hydration failures", async t =>
{
  const library = new CjsLibrary();
  t.after(() => library.Shutdown());
  let result = null;
  const sof = { BuildFromDNA() { return result; } };
  await library.Initialize({ sof });
  assert.equal(await library.Fetch("h:f:r"), null);
  result = { _type: "UnregisteredSofFetchFixture" };
  await assert.rejects(library.Fetch("h:f:r"), /UnregisteredSofFetchFixture/);
  const failure = new Error("catalog failed");
  t.mock.method(sof, "BuildFromDNA", () => { throw failure; });
  await assert.rejects(library.Fetch("h:f:r"), error => error === failure);
  await library.Shutdown();
  await library.Initialize({ sof: null });
  await assert.rejects(library.Fetch("h:f:r"), /SOF is not configured/);
});

test("default library SOF loads lazily and creates independent live graphs without changing values", async t =>
{
  const library = new CjsLibrary();
  t.after(() => library.Shutdown());
  const base = "res:/dx9/model/spaceobjectfactory";
  const records = new Map([
    [`${base}/generic.black`, {}],
    [`${base}/hulls/test.black`, { name: "test", buildClass: 0, opaqueAreas: [], boundingSphere: [0, 0, 0, 1] }],
    [`${base}/factions/neutral.black`, { name: "neutral" }],
    [`${base}/races/neutral.black`, { name: "neutral" }]
  ]);
  const reads = [];
  t.mock.method(blue.resMan, "FetchObject", async path =>
  {
    reads.push(path);
    assert.ok(records.has(path), `unexpected SOF record ${path}`);
    return records.get(path);
  });
  await library.Initialize();
  assert.deepEqual(reads, [], "initialization configures but does not acquire the catalog");
  const dna = "test:neutral:neutral";
  const values = await blue.sof.BuildValuesFromDNA(dna);
  const before = structuredClone(values);
  const initialize = t.mock.method(EveShip2.prototype, "Initialize");
  const first = await library.Fetch(dna);
  const second = await library.Fetch(dna);
  assert.equal(first.constructor, EveShip2);
  assert.equal(second.constructor, EveShip2);
  assert.notEqual(first, second);
  assert.notEqual(first.mesh, second.mesh);
  assert.equal(initialize.mock.callCount(), 2, "each root initializes once, through the temporary bridge");
  assert.deepEqual(values, before);
  assert.deepEqual(await blue.sof.BuildValuesFromDNAAsync(dna), before, "Tools Core keeps the values service");
  assert.equal(values._type, "EveShip2");
  assert.equal(reads.length, 4, "the catalog is reused across both output paths");
});
