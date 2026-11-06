import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import * as graph from "../../src/global/model/graph/index.js";
import { CjsSchema } from "../../npm/dist/blue/schema/CjsSchema.js";
import { CjsBlackReader } from "../../npm/dist/blue/formats/black/core/CjsBlackReader.js";
import { DictReader } from "../../npm/dist/blue/formats/graph/DictReader.js";
// Scene construction registers device resources; no device or GPU is created by this import.
import "../../npm/dist/trinity/core/device/TriDevice.js";
import { EveSpaceScene } from "../../npm/dist/trinity/eve/scene/EveSpaceScene.js";
import { Tr2Effect } from "../../npm/dist/trinity/shader/Tr2Effect.js";
import { Tr2ConstantEffectParameter } from "../../npm/dist/trinity/shader/parameter/Tr2ConstantEffectParameter.js";
import { TriTextureParameter } from "../../npm/dist/trinity/shader/parameter/TriTextureParameter.js";

const { CjsGraph } = graph;

// Fetch through tools-core /eve/3569502/resources/dx9/scene/universe/ into an external directory.
// No game bytes are committed. Compares the graph with DictWriter and DictReader from outside:
// the graph imports neither. Everything runs initialize:false, because the family's initializers
// request resources. Set CJS_GRAPH_VALUE_BENCH for the timing run.
const corpus = process.env.CJS_GRAPH_SCENE_CORPUS;
const fixtures = [
  [ "a01_cube", "262d7ed669488bb23d7761a079b2866fa197d994c76c49357ace37dbf800ae51" ],
  [ "c04_cube", "46ce7a24df1fd1b111b20e813071395d9e3844f373630a8dddf13aa8eb986390" ],
  [ "g01_cube", "0c2fbab3084277efa912807defc6e81f39afb0f6b36b03748e145ca4c7658f8a" ],
  [ "m01_cube", "0177243c92779e94936510b804e9dfa9b592e4288a2496b0a77fc1c04b6807c9" ]
];
const family = [ EveSpaceScene, Tr2Effect, Tr2ConstantEffectParameter, TriTextureParameter ];
const persistOnly = { persistOnly: true };
const quiet = { notify: false, markDirty: false, reuseObjects: true, persistOnly: true };

/** Actual persistent declaration rows, kept outside the independent graph package. */
function persisted(ctor)
{
  return CjsSchema.getSchema(ctor).members.filter(member =>
    !member.type?.runtimeOnly && (member.edit?.persist || member.edit?.persistOnly));
}

/** External adapter for this bounded family, not a production Blue adapter. */
function registerFamily()
{
  const handler = name => new graph[`CjsGraphType${name}`]();
  const known = new Map(family.map(ctor => [ CjsSchema.getClassName(ctor), ctor ]));
  const leaves = {
    int32: handler("Int32"), uint32: handler("Uint32"), float32: handler("Float32"), float64: handler("Float64"),
    boolean: handler("Boolean"), string: handler("String"), path: handler("String"), color: handler("Color"),
    vec3: handler("Vector3"), vec4: handler("Vector4"), quat: handler("Quaternion")
  };
  const objects = { rootRef: handler("IRootPtr"), root: handler("IRoot"), rootWeak: handler("IRootWeakRef"), rawStruct: handler("Struct") };
  const list = handler("List");

  for (const ctor of family)
  {
    const members = persisted(ctor).map(member =>
    {
      const { kind, className, itemType } = member.type;
      const collection = kind === "list" || kind === "structList";
      const object = objects[kind];
      const child = collection ? className ?? itemType : className;
      assert.ok(collection || object || leaves[kind], `unreviewed member kind ${kind}`);

      return {
        name: member.name, key: member.key, index: member.index,
        handler: collection ? list : object ?? leaves[kind],
        edge: collection || object ? {
          kind: kind === "rawStruct" || kind === "structList" ? "embed" : "ref",
          collection, type: known.get(child) ?? null
        } : null
      };
    });
    CjsGraph.define(ctor, { name: CjsSchema.getClassName(ctor), members });
  }
}

function read(name, hash)
{
  const bytes = readFileSync(join(corpus, `${name}.black`));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), hash);

  const reader = new CjsBlackReader(bytes, { schema: null, initialize: false });
  const scene = reader.CreateObject();
  assert.deepEqual(reader.reports, []);
  return scene;
}

/** Both graphs must hold the same classes, storage types, values and sharing, walked by schema. */
function assertSameGraph(actual, expected)
{
  const pairs = new Map(), stack = [ [ actual, expected, "root" ] ];

  while (stack.length)
  {
    const [ a, b, path ] = stack.pop();
    if (a === null || b === null) { assert.equal(a, b, path); continue; }
    if (pairs.has(b)) { assert.equal(pairs.get(b), a, `${path}: topology`); continue; }
    pairs.set(b, a);

    assert.notEqual(a, b, `${path}: a separate graph`);
    assert.equal(a.constructor, b.constructor, `${path}: class`);

    for (const member of persisted(b.constructor))
    {
      const at = `${path}.${member.name}`;
      const left = member.index === undefined ? a[member.key] : a[member.key][member.index];
      const right = member.index === undefined ? b[member.key] : b[member.key][member.index];
      const kind = member.type.kind;

      if (kind === "list" || kind === "structList")
      {
        assert.equal(left.constructor, right.constructor, `${at}: list storage`);
        assert.equal(left.length, right.length, at);
        for (let i = 0; i < right.length; i++) stack.push([ left[i], right[i], `${at}[${i}]` ]);
      }
      else if (member.type.className || kind === "rootRef") stack.push([ left, right, at ]);
      else if (ArrayBuffer.isView(right))
      {
        assert.equal(left.constructor, right.constructor, `${at}: typed storage`);
        assert.notEqual(left.buffer, right.buffer, `${at}: independent storage`);
        assert.deepEqual(Array.from(left), Array.from(right), at);
      }
      else assert.ok(Object.is(left, right), `${at}: ${left} !== ${right}`);
    }
  }

  return pairs.size;
}

/** Alternates old and new in warmed batches, so neither runs on a colder JIT or heap. */
function measure(pairs)
{
  const iterations = 200, batches = 40, warmup = 10;
  const rows = [];

  for (const [ name, previous, next ] of pairs)
  {
    const samples = [ [], [] ], runs = [ previous, next ];

    for (let batch = 0; batch < batches; batch++)
    {
      for (let turn = 0; turn < 2; turn++)
      {
        const mode = (batch + turn) % 2, run = runs[mode];
        const start = performance.now();
        for (let i = 0; i < iterations; i++) run();
        if (batch >= warmup) samples[mode].push((performance.now() - start) / iterations * 1000);
      }
    }

    const [ old, neu ] = samples.map(sample => sample.sort((a, b) => a - b));
    const at = (sample, part) => sample[Math.floor(sample.length * part)];
    rows.push({ name, oldMedianUs: +at(old, 0.5).toFixed(1), newMedianUs: +at(neu, 0.5).toFixed(1),
      oldP95Us: +at(old, 0.95).toFixed(1), newP95Us: +at(neu, 0.95).toFixed(1),
      ratio: +(at(old, 0.5) / at(neu, 0.5)).toFixed(2) });
  }

  return rows;
}

test("graph operations match DictWriter and DictReader on the exact-build scenes", {
  skip: !corpus && "Set CJS_GRAPH_SCENE_CORPUS to the externally fetched four-scene directory."
}, context =>
{
  const start = performance.now();
  registerFamily();
  const defined = performance.now();

  for (const [ name, hash ] of fixtures)
  {
    const scene = read(name, hash);
    const first = performance.now();
    CjsGraph.get(scene);
    const compiled = performance.now();

    for (const tags of [ {}, { typeTags: true }, { forceTypeTags: true } ])
      assert.deepEqual(CjsGraph.get(scene, tags), CjsSchema.getValues(scene, {}, { ...persistOnly, ...tags }));

    // from: the same graph as the Black reader's, and as DictReader's from the same values.
    const tagged = CjsSchema.getValues(scene, {}, { ...persistOnly, typeTags: true });
    assert.deepEqual(CjsGraph.get(scene, { typeTags: true }), tagged);
    const built = CjsGraph.from(null, tagged, { skipEvents: true });
    const old = new DictReader({ initialize: false }).CreateObject(tagged, EveSpaceScene);
    assert.equal(assertSameGraph(built, scene), 11);
    assert.equal(assertSameGraph(built, old), 11);

    // Set into a fresh object keeps its typed and list storage.
    const fresh = new EveSpaceScene(), fog = fresh.fogColor, lists = fresh.curveSets;
    assert.notEqual(CjsGraph.set(fresh, tagged, { skipEvents: true }), false);
    assert.equal(fresh.fogColor, fog);
    assert.equal(fresh.curveSets, lists);
    assertSameGraph(fresh, scene);

    // An unchanged set changes nothing, and reports it, as the old path does.
    assert.equal(CjsGraph.set(built, tagged, { skipEvents: true }), false);
    assert.equal(CjsSchema.setValues(old, tagged, quiet).size, 0);
    assertSameGraph(built, scene);

    // A changed set records the same members the old path names, nested and listed.
    const effect = built.backgroundEffect, kept = effect.resources[0], resources = effect.resources;
    const changes = CjsGraph.set(built, {
      fogStart: built.fogStart + 1,
      ambientColor: [ 0.25, 0.5, 0.75, 1 ],
      backgroundEffect: { effectFilePath: "res:/changed.fx", resources: [ kept, { _type: "TriTextureParameter", name: "added" } ] }
    }, { skipEvents: true });
    assert.deepEqual(Object.keys(changes).sort(), [ "ambientColor", "backgroundEffect", "fogStart" ]);
    assert.deepEqual(changes.ambientColor, [ 0.25, 0.5, 0.75, 1 ]);
    assert.equal(changes.backgroundEffect.effectFilePath, "res:/changed.fx");
    assert.equal(changes.backgroundEffect.resources[0], kept);
    assert.equal(changes.backgroundEffect.resources[1], effect.resources[1]);
    assert.equal(built.backgroundEffect, effect);
    assert.equal(effect.resources, resources);
    assert.equal(effect.resources.length, 2);
    assert.equal(CjsGraph.set(built, { backgroundEffect: { effectFilePath: "res:/changed.fx" } }, { skipEvents: true }), false);

    const oldChanged = CjsSchema.setValues(old, { fogStart: old.fogStart + 1, ambientColor: [ 0.25, 0.5, 0.75, 1 ] }, quiet);
    assert.deepEqual([ ...oldChanged ].sort(), [ "ambientColor", "fogStart" ]);

    // Presets.
    assert.equal(assertSameGraph(CjsGraph.clone(scene, { skipEvents: true }), scene), 11);
    const target = new EveSpaceScene();
    assert.notEqual(CjsGraph.copy(scene, target, { skipEvents: true }), false);
    assertSameGraph(target, scene);

    context.diagnostic(JSON.stringify({ scene: name, phase: "first get, compiling member tables", ms: +(compiled - first).toFixed(3) }));
  }

  context.diagnostic(JSON.stringify({ phase: "define family", ms: +(defined - start).toFixed(3) }));

  if (!process.env.CJS_GRAPH_VALUE_BENCH) return;

  for (const [ name, hash ] of fixtures)
  {
    const scene = read(name, hash);
    const values = CjsSchema.getValues(scene, {}, { ...persistOnly, typeTags: true });
    const options = { typeTags: true };
    const quietReader = { initialize: false };
    const newTarget = CjsGraph.from(null, values, { skipEvents: true }), oldTarget = new DictReader(quietReader).CreateObject(values, EveSpaceScene);
    let flip = false;
    const change = {};

    const rows = measure([
      [ "get", () => CjsSchema.getValues(scene, {}, { ...persistOnly, typeTags: true }), () => CjsGraph.get(scene, options) ],
      // The effect subtree, 10 of the 11 objects: each EveSpaceScene stays alive through TriDevice.RegisterResource.
      [ "from", () => new DictReader(quietReader).CreateObject(values.backgroundEffect, Tr2Effect), () => CjsGraph.from(Tr2Effect, values.backgroundEffect, { skipEvents: true }) ],
      [ "set unchanged", () => CjsSchema.setValues(oldTarget, values, quiet), () => CjsGraph.set(newTarget, values, { skipEvents: true }) ],
      [ "set one changed member",
        () => { change.fogStart = (flip = !flip) ? 1 : 2; return CjsSchema.setValues(oldTarget, change, quiet); },
        () => { change.fogStart = (flip = !flip) ? 1 : 2; return CjsGraph.set(newTarget, change, { skipEvents: true }); } ]
    ]);
    context.diagnostic(JSON.stringify({ scene: name, node: process.version, iterations: 200, batches: 30, objects: 11, rows }));
  }
});
