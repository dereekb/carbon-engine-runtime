// Compares the graph with the old values path on real content, from outside. One shard:
//   node scripts/graph/graph-corpus-proof.mjs <target> <shard> <shards> <out.json> [scan|events|real] [every]
// scan: every .black file: key order, get values and a count of non-finite numbers.
// events: every Nth file and all character and interior files: Initialize, OnModified and OnListModified
// recorded and not run, for from, set and copy. real: the same files with real hooks, compared by value.
// skip: the same files, read back from a bag with defaults left out.
// Needs tools-core on 5510. CJS_GRAPH_DIST points at a private copy of npm (with its package.json) so a long
// run survives a shared build. Writes counts and res: paths only, never game bytes.
import { writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const DIST = join(here, process.env.CJS_GRAPH_DIST ?? "../../npm", "dist");
const load = path => import(pathToFileURL(join(DIST, path)).href);

const [ target, shardText, shardsText, outPath, mode = "scan", everyText = "1" ] = process.argv.slice(2);
const shard = Number(shardText), shards = Number(shardsText), every = Number(everyText);
const base = `http://localhost:5510/${target}/latest/`;

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
const { getClassRegistrations } = await load("blue/exposure/classes/registry.js");

CjsBlueGraph.register(blue.classes);

process.on("unhandledRejection", () => {});
process.on("uncaughtException", () => {});
if (mode === "real")
{
  const { trinity, TriDevice, Tr2FontManager, Tr2Renderer } = await load("trinity/index.js");
  if (!trinity.device) trinity.Initialize({ device: new TriDevice(), fontManager: Tr2FontManager.initialize(), renderer: Tr2Renderer });
}

// Quiet the runtime's own logging of bad content; the harness counts what it needs.
const log = console.log;
console.warn = console.error = console.log = console.info = console.debug = () => {};

async function ask(url, options = {})
{
  for (let attempt = 0; attempt < 20; attempt++)
  {
    try { return await fetch(url, { ...options, signal: AbortSignal.timeout(120000) }); }
    catch { await new Promise(done => setTimeout(done, 5000)); }
  }
  throw new Error("tools-core did not answer");
}

async function readBytes(path)
{
  const response = await ask(base + "res/" + path.replace(/^res:\//u, ""));
  return response.ok ? new Uint8Array(await response.arrayBuffer()) : null;
}

// ---- tracing: every Initialize, OnModified, OnListModified, recorded and not run.
let tracing = false, trace = [];
const nameOf = object => CjsSchema.getClassName(object.constructor) ?? "?";
const seenFns = new Set();
for (const { type } of getClassRegistrations())
{
  for (let proto = type.prototype; proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto))
  {
    for (const method of [ "Initialize", "OnModified", "OnListModified" ])
    {
      const descriptor = Object.getOwnPropertyDescriptor(proto, method);
      if (!descriptor || typeof descriptor.value !== "function" || seenFns.has(descriptor.value)) continue;
      const original = descriptor.value;
      const wrapped = function(...args)
      {
        if (!tracing) return original.apply(this, args);
        const who = nameOf(this);
        if (method === "OnModified")
        {
          const names = Array.isArray(args[0]) ? args[0] : args[0] instanceof Set ? [ ...args[0] ] : [ args[0] ];
          for (const name of names) trace.push(`${who}.OnModified(${String(name)})`);
        }
        else trace.push(`${who}.${method}(${method === "OnListModified" ? (args[0] ?? 0) & 0xff : ""})`);
        return true;
      };
      seenFns.add(wrapped);
      Object.defineProperty(proto, method, { ...descriptor, value: wrapped });
    }
  }
}

function traced(run)
{
  tracing = true;
  trace = [];
  try { run(); return trace; }
  finally { tracing = false; }
}

let currentPath = "";
const stats = {
  files: 0, unreadable: 0, notServed: 0, numbers: 0, nonFinite: {},
  order: { same: 0, differ: 0, first: {} }, get: { same: 0, differ: 0, first: {} }
};
const events = {
  from: { same: 0, multisetDiffer: 0, orderDiffer: 0, oldThrew: 0, newThrew: 0, bothThrew: 0, first: {} },
  setSame: { same: 0, differ: 0, first: {} },
  setChanged: { same: 0, differ: 0, threw: 0, first: {} },
  copy: { same: 0, differ: 0, valuesDiffer: 0, threw: 0, first: {} }
};

const note = (bucket, key, sample) =>
{
  const row = bucket.first[key] ??= { count: 0, sample };
  row.count++;
};

function scan(value, path, cls)
{
  if (typeof value === "number")
  {
    stats.numbers++;
    if (!Number.isFinite(value))
    {
      const key = `${cls}.${path}:${Number.isNaN(value) ? "NaN" : value > 0 ? "+Inf" : "-Inf"}`;
      stats.nonFinite[key] = (stats.nonFinite[key] ?? 0) + 1;
      (stats.nonFiniteFiles ??= {})[currentPath] = (stats.nonFiniteFiles[currentPath] ?? 0) + 1;
    }
    return;
  }
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value) || ArrayBuffer.isView(value))
  {
    for (let i = 0; i < value.length; i++) scan(value[i], path, cls);
    return;
  }
  const own = value._type ?? cls;
  for (const key of Object.keys(value))
  {
    if (key === "_id" || key === "_ref" || key === "_type") continue;
    if (key === "__bluemetadata__") stats.metadata = (stats.metadata ?? 0) + 1;
    scan(value[key], key, own);
  }
}

/** First place two bags hold the same keys in a different order. */
function orderDiff(a, b, path)
{
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return null;
  if (Array.isArray(a) || Array.isArray(b))
  {
    if (!Array.isArray(a) || !Array.isArray(b)) return null;
    for (let i = 0; i < Math.min(a.length, b.length); i++)
    {
      const found = orderDiff(a[i], b[i], path);
      if (found) return found;
    }
    return null;
  }
  const ka = Object.keys(a), kb = Object.keys(b);
  const cls = a._type ?? path;
  if (ka.join("\0") !== kb.join("\0"))
  {
    if ([ ...ka ].sort().join("\0") !== [ ...kb ].sort().join("\0")) return `${cls}:keys-differ`;
    return `${cls}:order`;
  }
  for (const key of ka)
  {
    const found = orderDiff(a[key], b[key], `${cls}.${key}`);
    if (found) return found;
  }
  return null;
}

function valueDiff(a, b, path = "", tolerance = 0)
{
  if (a === b || (a !== a && b !== b)) return null;
  if (typeof a === "number" && typeof b === "number" && (Math.fround(a) === Math.fround(b) || Math.abs(a - b) < tolerance)) return null;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return path;
  for (const key of new Set([ ...Object.keys(a), ...Object.keys(b) ]))
  {
    const found = valueDiff(a[key], b[key], `${path}.${key}`, tolerance);
    if (found) return found;
  }
  return null;
}

/** A copy of a bag with every number moved by one, for a set that changes things. */
function bump(value, seen = new Map())
{
  if (typeof value === "number") return value + 1;
  if (value === null || typeof value !== "object") return value;
  if (ArrayBuffer.isView(value)) return Array.from(value, item => typeof item === "number" ? item + 1 : item);
  if (Array.isArray(value)) return value.map(item => bump(item));
  const copy = {};
  for (const key of Object.keys(value)) copy[key] = key === "_id" || key === "_ref" || key === "_type" ? value[key] : bump(value[key]);
  return copy;
}

const multiset = list =>
{
  const counts = new Map();
  for (const item of list) counts.set(item, (counts.get(item) ?? 0) + 1);
  return counts;
};

function mismatches(oldTrace, newTrace)
{
  const a = multiset(oldTrace), b = multiset(newTrace), out = [];
  for (const [ key, count ] of a)
  {
    const other = b.get(key) ?? 0;
    if (other < count) out.push(`old+ ${key}`);
    else if (other > count) out.push(`new+ ${key}`);
  }
  for (const key of b.keys()) if (!a.has(key)) out.push(`new+ ${key}`);
  return out;
}

const reading = { persistOnly: true, typeTags: true, full: true };

const skip = { same: 0, differ: 0, threw: 0, fullKeys: 0, skippedKeys: 0, first: {} };
events.skip = skip;

const countKeys = value =>
{
  if (value === null || typeof value !== "object") return 0;
  if (Array.isArray(value)) return value.reduce((total, item) => total + countKeys(item), 0);
  return Object.keys(value).reduce((total, key) => total + 1 + countKeys(value[key]), 0);
};

/** A bag with defaults left out builds what the full bag describes. */
function checkSkip(root, path)
{
  try
  {
    const full = CjsGraph.get(root, reading), bag = CjsGraph.get(root, { persistOnly: true, typeTags: true });
    skip.fullKeys += countKeys(full);
    skip.skippedKeys += countKeys(bag);
    // Inside Carbon's tolerance a value reads back as its default, as SkipEquals leaves it.
    const held = valueDiff(CjsGraph.get(CjsGraph.from(null, { _type: nameOf(root), ...bag }, { skipEvents: true }), reading), full, "", 2e-6);
    if (held) { skip.differ++; note(skip, held.replace(/.d+/gu, "[]").slice(-80), path); }
    else skip.same++;
  }
  catch (error) { skip.threw++; note(skip, `threw ${String(error.message).slice(0, 80)}`, path); }
}

const real = { same: 0, differ: 0, oldThrew: 0, newThrew: 0, bothThrew: 0, first: {} };
events.real = real;

/** Real hooks on both sides, then the two results compared by value. */
function checkReal(root, values, path)
{
  const ctor = root.constructor;
  let oldBuilt = null, newBuilt = null, oldError = null, newError = null;
  try { oldBuilt = new DictReader({ initialize: true }).CreateObject(values, ctor); }
  catch (error) { oldError = error; }
  try { newBuilt = CjsGraph.from(null, values); }
  catch (error) { newError = error; }

  if (oldError || newError)
  {
    if (oldError && newError) { real.bothThrew++; note(real, `both ${String(oldError.message).slice(0, 70)}`, path); }
    else if (oldError) { real.oldThrew++; note(real, `oldThrew ${String(oldError.message).slice(0, 80)}`, path); }
    else { real.newThrew++; note(real, `newThrew ${String(newError.message).slice(0, 80)}`, path); }
    return;
  }

  const held = valueDiff(CjsGraph.get(oldBuilt, reading), CjsGraph.get(newBuilt, reading));
  if (held) { real.differ++; note(real, held.replace(/.d+/gu, "[]").slice(-80), path); }
  else real.same++;
}

function checkEvents(root, values, path)
{
  const ctor = root.constructor;

  // from, with events on.
  let oldBuilt = null, newBuilt = null, oldError = null, newError = null, oldTrace = [], newTrace = [];
  try { oldTrace = traced(() => { oldBuilt = new DictReader({ initialize: true }).CreateObject(values, ctor); }); }
  catch (error) { oldError = error; }
  const midOld = trace;
  try { newTrace = traced(() => { newBuilt = CjsGraph.from(null, values); }); }
  catch (error) { newError = error; }

  if (oldError || newError)
  {
    const bucket = events.from;
    if (oldError && newError) bucket.bothThrew++;
    else if (oldError) { bucket.oldThrew++; note(bucket, `oldThrew ${String(oldError.message).slice(0, 80)}`, path); }
    else { bucket.newThrew++; note(bucket, `newThrew ${String(newError.message).slice(0, 80)}`, path); }
    return;
  }

  const mismatch = mismatches(oldTrace, newTrace);
  if (mismatch.length) { events.from.multisetDiffer++; for (const key of mismatch) note(events.from, key, path); }
  else if (oldTrace.join("\n") !== newTrace.join("\n"))
  {
    events.from.orderDiffer++;
    let i = 0;
    while (oldTrace[i] === newTrace[i]) i++;
    note(events.from, `order ${oldTrace[i]} vs ${newTrace[i]}`, path);
  }
  else events.from.same++;

  // set, unchanged: neither side should tell anyone anything.
  const quietOld = traced(() => CjsSchema.setValues(oldBuilt, values, { reuseObjects: true }));
  const quietNew = traced(() => CjsGraph.set(newBuilt, values));
  const quietDiff = mismatches(quietOld, quietNew);
  if (quietDiff.length) { events.setSame.differ++; for (const key of quietDiff) note(events.setSame, key, path); }
  else events.setSame.same++;

  // set, every number moved.
  try
  {
    const moved = bump(values);
    const changedOld = traced(() => CjsSchema.setValues(oldBuilt, moved, { reuseObjects: true }));
    const changedNew = traced(() => CjsGraph.set(newBuilt, moved));
    const changedDiff = mismatches(changedOld, changedNew);
    if (changedDiff.length) { events.setChanged.differ++; for (const key of changedDiff) note(events.setChanged, key, path); }
    else events.setChanged.same++;
  }
  catch (error) { events.setChanged.threw++; note(events.setChanged, `threw ${String(error.message).slice(0, 80)}`, path); }

  // copy into a new target.
  try
  {
    const oldTarget = new ctor(), newTarget = new ctor();
    const copyOld = traced(() => new Copier().CopyTo(root, oldTarget));
    const copyNew = traced(() => CjsGraph.copy(root, newTarget));
    const copyDiff = mismatches(copyOld, copyNew);
    if (copyDiff.length) { events.copy.differ++; for (const key of copyDiff) note(events.copy, key, path); }
    else events.copy.same++;
    const held = valueDiff(CjsGraph.get(oldTarget, reading), CjsGraph.get(newTarget, reading));
    if (held) { events.copy.valuesDiffer++; note(events.copy, `value ${held.replace(/\.\d+/gu, "[]").slice(0, 100)}`, path); }
  }
  catch (error) { events.copy.threw++; note(events.copy, `threw ${String(error.message).slice(0, 80)}`, path); }
}

const all = await (await ask(base + "resfiles")).json();
const wanted = all.filter(path => /\.black$/iu.test(path) && !path.includes("/shaders/")).sort();
const isCharacter = path => /\/(character|interior)\//iu.test(path);

for (let index = shard; index < wanted.length; index += shards)
{
  const path = wanted[index];
  const eventsHere = mode !== "scan" && (isCharacter(path) || index % every === 0);
  if (mode !== "scan" && !eventsHere) continue;

  let root;
  try
  {
    const bytes = await readBytes(path);
    if (!bytes) { stats.notServed++; continue; }
    root = new CjsBlackReader(bytes, { schema: null, initialize: false }).CreateObject();
  }
  catch (error)
  {
    stats.unreadable++;
    continue;
  }
  if (!root || typeof root !== "object") { stats.unreadable++; continue; }

  stats.files++;
  let values;
  try { values = CjsSchema.getValues(root, {}, reading); }
  catch (error) { note(stats.get, `oldGetThrew ${String(error.message).slice(0, 80)}`, path); continue; }

  currentPath = path;
  scan(values, "", nameOf(root));

  try
  {
    const bag = CjsGraph.get(root, reading);
    const held = valueDiff(bag, values);
    if (held) { stats.get.differ++; note(stats.get, held.replace(/\.\d+/gu, "[]").slice(0, 100), path); }
    else stats.get.same++;

    const order = orderDiff(bag, values, nameOf(root));
    if (order) { stats.order.differ++; note(stats.order, order, path); }
    else stats.order.same++;
  }
  catch (error) { stats.get.differ++; note(stats.get, `newGetThrew ${String(error.message).slice(0, 80)}`, path); }

  if (eventsHere)
  {
    try { if (mode === "real") checkReal(root, values, path); else if (mode === "skip") checkSkip(root, path); else checkEvents(root, values, path); }
    catch (error) { note(events.copy, `harness ${String(error.message).slice(0, 100)}`, path); }
  }
}

writeFileSync(outPath, JSON.stringify({ target, shard, shards, mode, stats, events }, null, 1));
log(`done ${target} ${shard}/${shards} files ${stats.files}`);
process.exit(0);
