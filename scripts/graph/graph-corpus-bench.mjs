// Times the graph against the old values path on real files:
//   node scripts/graph/graph-corpus-bench.mjs timing | get | set | from | copy [every]
// With --cpu-prof a named op loops alone, so the profile holds that op only. Hooks are called and do nothing.
// Needs tools-core on 5510. CJS_GRAPH_DIST as in graph-corpus-proof.mjs. Writes timings only, never game bytes.
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const DIST = join(here, process.env.CJS_GRAPH_DIST ?? "../../npm", "dist");
const load = path => import(pathToFileURL(join(DIST, path)).href);
const op = process.argv[2] ?? "timing";
const every = Number(process.argv[3] ?? 38);
const base = "http://localhost:5510/eve/latest/";

function walk(dir, files = [])
{
  for (const entry of readdirSync(dir, { withFileTypes: true }))
  {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== "workers") walk(full, files); }
    else if (entry.name.endsWith(".js") && !/worker|\.min\.|bundle/i.test(entry.name)) files.push(full);
  }
  return files;
}
for (const file of walk(DIST).sort()) await import(pathToFileURL(file).href);

const { blue } = await load("blue/index.js");
const { CjsSchema } = await load("blue/schema/index.js");
const { CjsBlackReader } = await load("blue/formats/black/core/CjsBlackReader.js");
const { DictReader } = await load("blue/formats/graph/DictReader.js");
const { CjsBlueGraph } = await load("blue/formats/graph/index.js");
const { CjsGraph } = await load("global/model/graph/index.js");
const { Copier } = await load("blue/exposure/Copier.js");

CjsBlueGraph.register(blue.classes);

// Hooks are called and do nothing: timing the walk, not resource requests.
const { getClassRegistrations } = await load("blue/exposure/classes/registry.js");
const seenFns = new Set();
for (const { type } of getClassRegistrations())
{
  for (let proto = type.prototype; proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto))
  {
    for (const method of [ "Initialize", "OnModified", "OnListModified" ])
    {
      const descriptor = Object.getOwnPropertyDescriptor(proto, method);
      if (!descriptor || typeof descriptor.value !== "function" || seenFns.has(descriptor.value)) continue;
      const wrapped = function() { return true; };
      seenFns.add(wrapped);
      Object.defineProperty(proto, method, { ...descriptor, value: wrapped });
    }
  }
}

const log = console.log;
console.warn = console.error = console.log = console.info = console.debug = () => {};

const all = await (await fetch(base + "resfiles")).json();
const wanted = all.filter(path => /\.black$/iu.test(path) && !path.includes("/shaders/")).sort();
const files = wanted.filter((path, index) => index % every === 0);

const reading = { persistOnly: true, typeTags: true, full: true };
const events = { skipEvents: true };
const quiet = { notify: false, markDirty: false, reuseObjects: true };
const rows = [];

for (const path of files)
{
  const response = await fetch(base + "res/" + path.replace(/^res:\//u, ""));
  if (!response.ok) continue;
  try
  {
    const bytes = new Uint8Array(await response.arrayBuffer());
    const root = new CjsBlackReader(bytes, { schema: null, initialize: false }).CreateObject();
    if (!root || typeof root !== "object") continue;
    const values = CjsSchema.getValues(root, {}, reading);
    rows.push({
      root, values,
      newTarget: CjsGraph.from(null, values, events),
      oldTarget: new DictReader({ initialize: false }).CreateObject(values, root.constructor),
      copyNew: new root.constructor(), copyOld: new root.constructor()
    });
  }
  catch { /* the Black reader cannot read a few files; they count against nothing here */ }
}

const passes = {
  get: [ row => CjsSchema.getValues(row.root, {}, reading), row => CjsGraph.get(row.root, process.env.BENCH_SKIP ? { persistOnly: true, typeTags: true } : reading) ],
  set: [ row => CjsSchema.setValues(row.oldTarget, row.values, quiet), row => CjsGraph.set(row.newTarget, row.values, events) ],
  from: [ row => new DictReader({ initialize: false }).CreateObject(row.values, row.root.constructor), row => CjsGraph.from(null, row.values, events) ],
  copy: [ row => new Copier().CopyTo(row.root, row.copyOld), row => CjsGraph.copy(row.root, row.copyNew) ]
};

if (op !== "timing")
{
  const run = passes[op][process.argv[4] === "old" ? 0 : 1];
  const start = performance.now();
  let loops = 0;
  while (performance.now() - start < Number(process.env.BENCH_MS ?? 15000))
  {
    for (const row of rows) run(row);
    loops++;
  }
  log(JSON.stringify({ op, files: rows.length, loops, msPerPass: +((performance.now() - start) / loops).toFixed(1) }));
  process.exit(0);
}

if (process.env.BENCH_NEWONLY)
{
  const result = {};
  for (let round = 0; round < 3; round++)
  {
    for (const [ name, runs ] of Object.entries(passes))
    {
      const samples = [];
      for (let pass = 0; pass < 9; pass++)
      {
        const start = performance.now();
        for (const row of rows) runs[1](row);
        if (pass >= 3) samples.push(performance.now() - start);
      }
      (result[name] ??= []).push(+samples.sort((a, b) => a - b)[samples.length >> 1].toFixed(1));
    }
  }
  log(JSON.stringify({ variant: process.env.BENCH_VARIANT, files: rows.length, result }));
  process.exit(0);
}

const result = [];
for (const [ name, runs ] of Object.entries(passes))
{
  const samples = [ [], [] ];
  for (let pass = 0; pass < 11; pass++)
  {
    for (let turn = 0; turn < 2; turn++)
    {
      const mode = (pass + turn) % 2, start = performance.now();
      for (const row of rows) runs[mode](row);
      if (pass >= 3) samples[mode].push(performance.now() - start);
    }
  }
  const [ old, neu ] = samples.map(sample => sample.sort((a, b) => a - b)[sample.length >> 1]);
  result.push({ name, oldMs: +old.toFixed(1), newMs: +neu.toFixed(1), ratio: +(old / neu).toFixed(2) });
}
log(JSON.stringify({ node: process.version, files: rows.length, timing: result }));
process.exit(0);
