import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { CjsGraph, CjsGraphTypeObject, CjsGraphTypeList, CjsGraphTypeScalar } from "../../src/global/model/graph/index.js";
import { CjsSchema } from "../../npm/dist/blue/schema/CjsSchema.js";
import { CjsBlackReader } from "../../npm/dist/blue/formats/black/core/CjsBlackReader.js";
// Scene construction registers device resources; no device or GPU is created by this import.
import "../../npm/dist/trinity/core/device/TriDevice.js";
import { EveSpaceScene } from "../../npm/dist/trinity/eve/scene/EveSpaceScene.js";
import { Tr2Effect } from "../../npm/dist/trinity/shader/Tr2Effect.js";
import { Tr2ConstantEffectParameter } from "../../npm/dist/trinity/shader/parameter/Tr2ConstantEffectParameter.js";
import { TriTextureParameter } from "../../npm/dist/trinity/shader/parameter/TriTextureParameter.js";
import { TriTextureRes } from "../../npm/dist/trinity/resources/texture/TriTextureRes.js";
import { Tr2EffectRes } from "../../npm/dist/trinity/shader/Tr2EffectRes.js";

// Fetch through tools-core /eve/3569502/resources/dx9/scene/universe/ into an external directory.
// No game bytes are committed. These are authored environment graphs, not populated combat scenes.
const corpus = process.env.CJS_GRAPH_SCENE_CORPUS;
const fixtures = [
  ["a01_cube", "262d7ed669488bb23d7761a079b2866fa197d994c76c49357ace37dbf800ae51"],
  ["c04_cube", "46ce7a24df1fd1b111b20e813071395d9e3844f373630a8dddf13aa8eb986390"],
  ["g01_cube", "0c2fbab3084277efa912807defc6e81f39afb0f6b36b03748e145ca4c7658f8a"],
  ["m01_cube", "0177243c92779e94936510b804e9dfa9b592e4288a2496b0a77fc1c04b6807c9"]
];
const family = [EveSpaceScene, Tr2Effect, Tr2ConstantEffectParameter, TriTextureParameter];
const objectKinds = new Set(["root", "rootRef", "object", "rawStruct"]);
const listKinds = new Set(["list", "structList"]);

/** Actual persistent declaration rows, kept outside the independent graph package. */
function persisted(ctor)
{
  return CjsSchema.getSchema(ctor).members.filter(member =>
    !member.type?.runtimeOnly && (member.edit?.persist || member.edit?.persistOnly));
}

/**
 * Traversal-only external adapter for this bounded family, not a production Blue adapter.
 * Unknown/interface target types stay dynamic; no fabricated concrete class narrowing.
 * Scalar handlers are placeholders here: no Get/Set/conversion operation is exercised.
 */
function registerFamily()
{
  const known = new Map(family.map(ctor => [CjsSchema.getClassName(ctor), ctor]));
  for (const ctor of family)
  {
    const members = persisted(ctor).map(member =>
    {
      const type = member.type;
      const collection = listKinds.has(type.kind);
      const object = objectKinds.has(type.kind);
      const childType = collection ? type.className ?? type.itemType : type.className;
      return {
        name: member.name, key: member.key, index: member.index,
        handler: collection ? CjsGraphTypeList : object ? CjsGraphTypeObject : CjsGraphTypeScalar,
        edge: collection || object ? {
          kind: type.kind === "rawStruct" || type.kind === "structList" ? "embed" : "ref",
          collection, type: known.get(childType) ?? null
        } : null
      };
    });

    // Runtime handle storage verified in the owning classes; it is not persisted in Black.
    if (ctor === EveSpaceScene)
    {
      for (const name of ["envMap1", "envMap2", "envMap3", "_envMapTextureRes", "_staticEnvMapTextureRes"])
        members.push({ name, handler: CjsGraphTypeObject, edge: { kind: "ref" } });
    }
    if (ctor === Tr2Effect)
      members.push({ name: "effectResource", key: "_effectResource", handler: CjsGraphTypeObject, edge: { kind: "ref", type: Tr2EffectRes } });
    if (ctor === TriTextureParameter)
    {
      for (const name of ["resource", "_lowResResource"])
        members.push({ name, handler: CjsGraphTypeObject, edge: { kind: "ref" } });
    }
    CjsGraph.define(ctor, { name: CjsSchema.getClassName(ctor), members });
  }
  CjsGraph.define(TriTextureRes, { name: "TriTextureRes", members: [] });
  CjsGraph.define(Tr2EffectRes, { name: "Tr2EffectRes", members: [] });
}

/** Independent schema inventory guards against the bounded adapter silently losing authored objects. */
function inventory(root)
{
  const seen = new Set(), counts = new Map(), stack = [[root, null]];
  while (stack.length)
  {
    const [object, declared] = stack.pop();
    if (object === null || seen.has(object)) continue;
    assert.equal(typeof object, "object");
    seen.add(object);
    const ctor = Object.getPrototypeOf(object)?.constructor === Object ? CjsSchema.getConstructor(declared) : object.constructor;
    assert.ok(family.includes(ctor), "corpus exceeded the reviewed family");
    const name = CjsSchema.getClassName(ctor);
    counts.set(name, (counts.get(name) ?? 0) + 1);
    for (const member of persisted(ctor))
    {
      const own = Object.getOwnPropertyDescriptor(object, member.key);
      assert.ok(own && Object.hasOwn(own, "value"), `${name}.${member.name} must be stored data`);
      const value = member.index === undefined ? own.value : own.value[member.index];
      if (objectKinds.has(member.type.kind)) stack.push([value, member.type.className]);
      else if (listKinds.has(member.type.kind))
      {
        assert.ok(Array.isArray(value));
        for (const child of value) stack.push([child, member.type.className ?? member.type.itemType]);
      }
      else assert.ok(value === null || typeof value !== "object" || ArrayBuffer.isView(value),
        `unreviewed non-scalar declaration: ${name}.${member.name}`);
    }
  }
  return [...counts].sort(([a], [b]) => a.localeCompare(b));
}

/** Strict identity/order comparison, never structural equality of similar resource objects. */
function sameIdentities(actual, expected)
{
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < actual.length; i++) assert.equal(actual[i], expected[i]);
}

/**
 * Attach unloaded real resource instances using authored paths. This models runtime handle
 * topology only: it does not invoke Initialize/Acquire/Prepare, decode textures or load shaders.
 * Direct backing writes deliberately avoid resource-manager notification side effects.
 */
function attachHandles(scene, handles)
{
  const get = (ctor, path) =>
  {
    if (!path) return null;
    if (!handles.has(path))
    {
      const handle = new ctor();
      handle._path = path;
      handles.set(path, handle);
    }
    const handle = handles.get(path);
    assert.equal(handle.constructor, ctor);
    return handle;
  };
  const effect = scene.backgroundEffect;
  effect._effectResource = get(Tr2EffectRes, effect.effectFilePath);
  for (const parameter of effect.resources) parameter.resource = get(TriTextureRes, parameter.resourcePath);
  for (const index of [1, 2, 3]) scene[`envMap${index}`] = get(TriTextureRes, scene[`envMap${index}ResPath`]);
  scene._staticEnvMapTextureRes = get(TriTextureRes, scene.envMapResPath);
  scene._envMapTextureRes = scene._staticEnvMapTextureRes;

  // Independent expected order: effect's authored texture slots, effect handle, scene maps.
  const expected = [], seen = new Set();
  const candidates = Array.from(effect.resources, parameter => parameter.resource);
  candidates.push(effect._effectResource, scene.envMap1, scene.envMap2, scene.envMap3,
    scene._envMapTextureRes, scene._staticEnvMapTextureRes);
  for (const handle of candidates)
  {
    if (handle && !seen.has(handle)) { seen.add(handle); expected.push(handle); }
  }
  return expected;
}

/** Alternating warmed batches, reported per walk; initialization/acquisition are outside timing. */
function measure(root, selection)
{
  const outputs = [[], []], options = [{ prune: false }, {}], samples = [[], []];
  const iterations = 500;
  for (let batch = 0; batch < 40; batch++)
  {
    for (let turn = 0; turn < 2; turn++)
    {
      const mode = (batch + turn) % 2, output = outputs[mode];
      const start = performance.now();
      for (let i = 0; i < iterations; i++)
      {
        output.length = 0;
        CjsGraph.select(root, selection, output, options[mode]);
      }
      if (batch >= 10) samples[mode].push((performance.now() - start) / iterations);
    }
  }
  for (const sample of samples) sample.sort((a, b) => a - b);
  sameIdentities(outputs[0], outputs[1]);
  return { samples: samples[0].length, walksPerSample: iterations, fullMedianMs: samples[0][15], cachedMedianMs: samples[1][15] };
}

test("exact-build real environment graphs preserve full/cached selection identity and order", {
  skip: !corpus && "Set CJS_GRAPH_SCENE_CORPUS to the externally fetched four-scene directory."
}, context =>
{
  registerFamily();
  const parameterSelection = CjsGraph.compileSelection({ matchClass: info => info.ctor === TriTextureParameter });
  const start = performance.now();
  const resourceSelection = CjsGraph.compileSelection({ matchClass: info => info.ctor === TriTextureRes || info.ctor === Tr2EffectRes });
  const selectionCompileMsWithWarmClasses = performance.now() - start;
  const handles = new Map();
  const scenes = [];

  for (const [name, hash] of fixtures)
  {
    const bytes = readFileSync(join(corpus, `${name}.black`));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), hash);
    const reader = new CjsBlackReader(bytes, { schema: null, initialize: false });
    const scene = reader.CreateObject();
    assert.deepEqual(reader.reports, []);
    assert.equal(reader.reader.AtEnd(), true);
    assert.deepEqual(inventory(scene), [
      ["EveSpaceScene", 1], ["Tr2ConstantEffectParameter", 5], ["Tr2Effect", 1], ["TriTextureParameter", 4]
    ]);
    assert.equal(CjsGraph.traverse(scene, () => {}), 11);
    scenes.push(scene);

    const parameters = Array.from(scene.backgroundEffect.resources);
    sameIdentities(CjsGraph.select(scene, parameterSelection, [], { prune: false }), parameters);
    sameIdentities(CjsGraph.select(scene, parameterSelection, []), parameters);
    assert.deepEqual(CjsGraph.select(scene, resourceSelection, [], { prune: false }), []);
    assert.deepEqual(CjsGraph.select(scene, resourceSelection, []), []);

    const expected = attachHandles(scene, handles);
    assert.equal(expected.length, 6, "resource comparison must exercise every distinct authored handle");
    const reference = [];
    CjsGraph.traverse(scene, (object, info) =>
    {
      if (info.ctor === TriTextureRes || info.ctor === Tr2EffectRes) reference.push(object);
    });
    sameIdentities(reference, expected);
    const full = {}, cached = {};
    sameIdentities(CjsGraph.select(scene, resourceSelection, [], { prune: false, stats: full }), expected);
    sameIdentities(CjsGraph.select(scene, resourceSelection, [], { stats: cached }), expected);
    assert.equal(full.visited, 17);
    assert.equal(cached.visited, 12);
    assert.equal(cached.compiledClasses, 0);
    assert.equal(scene._envMapTextureRes, scene._staticEnvMapTextureRes);
    assert.equal(scene.envMap1, scene.backgroundEffect.resources[0].resource);
    context.diagnostic(JSON.stringify({ scene: name, phase: "real authored topology with staged unloaded handles",
      handles: expected.length, fullVisited: full.visited, cachedVisited: cached.visited, selectionCompileMsWithWarmClasses,
      ...(process.env.CJS_GRAPH_SELECTION_BENCH ? measure(scene, resourceSelection) : {}) }));
  }

  // Shared resources across four different real scenes must also be emitted only once.
  class SceneBatch { scenes = []; }
  CjsGraph.define(SceneBatch, { name: "RealSceneSelectionBatch", members: [
    { name: "scenes", handler: CjsGraphTypeList, edge: { kind: "ref", type: EveSpaceScene, collection: true } }
  ] });
  const batch = new SceneBatch();
  batch.scenes = scenes;
  const full = CjsGraph.select(batch, resourceSelection, [], { prune: false });
  sameIdentities(CjsGraph.select(batch, resourceSelection, []), full);
  assert.equal(full.length, handles.size);
  assert.equal(full.length, 15, "shared authored paths must deduplicate across scenes");
  context.diagnostic(`Four-scene batch: ${full.length} unique staged resource identities, full/cached order identical.`);
});
