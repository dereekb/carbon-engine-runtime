import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { blue } from "../../npm/dist/blue/index.js";
import { CjsSchema } from "../../npm/dist/blue/schema/index.js";
import { CjsBlackReader } from "../../npm/dist/blue/formats/black/core/CjsBlackReader.js";
import { DictReader } from "../../npm/dist/blue/formats/graph/DictReader.js";
import { CjsBlueGraph, CjsBlueGraphPolicy } from "../../npm/dist/blue/formats/graph/index.js";
import { CjsGraph } from "../../npm/dist/global/model/graph/index.js";
import { ImportAllDistModules } from "../support/allDistClasses.js";

// Compares graph operations with DictWriter and DictReader on every Nth .black file of the
// index, from outside, through Blue's policy with notification off. Needs a running tools-core:
// set CJS_GRAPH_VALUE_CORPUS to its base URL (for example .../eve/latest/) and
// CJS_GRAPH_VALUE_LIMIT to the sample size. CJS_TOOL_CORE_CACHE reads bytes from its disk cache,
// so the server never carries them. CJS_GRAPH_VALUE_BENCH adds timing. No game bytes are kept.
const base = process.env.CJS_GRAPH_VALUE_CORPUS;
const limit = Number(process.env.CJS_GRAPH_VALUE_LIMIT ?? 500);
const cache = process.env.CJS_TOOL_CORE_CACHE;

/** Waits out a tools-core restart, so an outage is never counted as a bad file. */
async function ask(url, options = {})
{
  for (let attempt = 0; attempt < 40; attempt++)
  {
    try { return await fetch(url, { ...options, signal: AbortSignal.timeout(60000) }); }
    catch { await new Promise(done => setTimeout(done, 15000)); }
  }

  throw new Error("tools-core did not answer");
}

async function readBytes(path)
{
  const url = base + "res/" + path.replace(/^res:\//u, "");

  if (cache)
  {
    const head = await ask(url, { headers: { range: "bytes=0-0" } });
    await head.body?.cancel();
    if (!head.ok) return null;

    const relative = head.headers.get("x-carbon-resfile");
    if (relative && existsSync(cache + relative)) return new Uint8Array(readFileSync(cache + relative));
  }

  const response = await ask(url);
  return response.ok ? new Uint8Array(await response.arrayBuffer()) : null;
}

/** The first path where two plain values differ, or null. */
function firstDiff(a, b, path = "")
{
  if (Object.is(a, b)) return null;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return path;

  for (const key of new Set([ ...Object.keys(a), ...Object.keys(b) ]))
  {
    const found = firstDiff(a[key], b[key], `${path}.${key}`);
    if (found) return found;
  }

  return null;
}

/** Counts the leaf differences, keeping signed zero apart from a real difference in value. */
function classify(neu, old, counts)
{
  if (Object.is(neu, old)) return;

  if (typeof neu === "number" && typeof old === "number")
  {
    if (neu === old) counts.signedZero++;
    else if (Math.abs(neu - old) < 1e-6) counts.tiny++;
    else counts.other++;
    return;
  }

  if (typeof neu !== "object" || typeof old !== "object" || neu === null || old === null)
  {
    counts.other++;
    return;
  }

  for (const key of new Set([ ...Object.keys(neu), ...Object.keys(old) ])) classify(neu[key], old[key], counts);
}

/** Total milliseconds for one pass over every file, alternating the old and new path. */
function measure(rows, policy)
{
  const options = { policy, typeTags: true };
  const quiet = { notify: false, markDirty: false, reuseObjects: true };
  const reader = { initialize: false };
  const passes = [
    [ "get", row => CjsSchema.getValues(row.root, {}, { persistOnly: true, typeTags: true }), row => CjsGraph.get(row.root, options) ],
    [ "set unchanged", row => CjsSchema.setValues(row.oldTarget, row.values, quiet), row => CjsGraph.set(row.newTarget, row.values, { policy }) ]
  ];

  // A scene stays alive through TriDevice.RegisterResource, so from runs once per pass, not in a loop.
  passes.push([ "from", row => new DictReader(reader).CreateObject(row.values, row.root.constructor), row => CjsGraph.from(null, row.values, { policy }) ]);

  const result = [];
  for (const [ name, previous, next ] of passes)
  {
    const samples = [ [], [] ], runs = [ previous, next ];

    for (let pass = 0; pass < 9; pass++)
    {
      for (let turn = 0; turn < 2; turn++)
      {
        const mode = (pass + turn) % 2, start = performance.now();
        for (const row of rows) runs[mode](row);
        if (pass >= 3) samples[mode].push(performance.now() - start);
      }
    }

    const [ old, neu ] = samples.map(sample => sample.sort((a, b) => a - b)[3]);
    result.push({ name, oldMs: +old.toFixed(1), newMs: +neu.toFixed(1), ratio: +(old / neu).toFixed(2) });
  }

  return result;
}

test("graph operations match the old path on a sample of real content", {
  skip: !base && "Set CJS_GRAPH_VALUE_CORPUS to a tools-core base URL.",
  timeout: 1200000
}, async context =>
{
  await ImportAllDistModules();
  CjsBlueGraph.register(blue.classes);

  const policy = new CjsBlueGraphPolicy({ persistOnly: true, notify: false });
  const all = await (await ask(base + "resfiles")).json();
  const wanted = all.filter(path => /\.black$/iu.test(path));
  const step = Math.max(1, Math.floor(wanted.length / limit));
  const files = wanted.filter((_, index) => index % step === 0);

  const stats = { files: 0, unreadable: 0, getSame: 0, setFalse: 0, fromSame: 0, fromSignedZeroOnly: 0, fromTiny: 0, fromThrew: 0 };
  const counts = { signedZero: 0, tiny: 0, other: 0 };
  const failures = [], rows = [];

  for (const path of files)
  {
    let root;
    try
    {
      const bytes = await readBytes(path);
      if (!bytes) throw new Error("not served");
      root = new CjsBlackReader(bytes, { schema: null, initialize: false }).CreateObject();
    }
    catch
    {
      stats.unreadable++;
      continue;
    }
    if (!root || typeof root !== "object") { stats.unreadable++; continue; }

    stats.files++;
    const values = CjsSchema.getValues(root, {}, { persistOnly: true, typeTags: true });

    const diff = firstDiff(CjsGraph.get(root, { policy, typeTags: true }), values);
    if (diff) failures.push(`get ${path} ${diff}`);
    else stats.getSame++;

    let built;
    try { built = CjsGraph.from(null, values, { policy }); }
    catch (error)
    {
      stats.fromThrew++;
      context.diagnostic(`from threw on ${path}: ${error.message}`);
      continue;
    }

    const again = CjsGraph.get(built, { policy, typeTags: true });
    if (!firstDiff(again, values)) stats.fromSame++;
    else
    {
      const before = counts.tiny, otherBefore = counts.other;
      classify(again, values, counts);
      if (counts.other > otherBefore) failures.push(`from ${path} ${firstDiff(again, values)}`);
      else if (counts.tiny > before) stats.fromTiny++;
      else stats.fromSignedZeroOnly++;
    }

    if (CjsGraph.set(built, values, { policy }) === false) stats.setFalse++;
    else failures.push(`set ${path}`);

    if (process.env.CJS_GRAPH_VALUE_BENCH)
    {
      rows.push({ root, values, newTarget: built, oldTarget: new DictReader({ initialize: false }).CreateObject(values, root.constructor) });
    }
  }

  context.diagnostic(JSON.stringify({ stats, counts }));
  if (rows.length) context.diagnostic(JSON.stringify({ node: process.version, files: rows.length, passes: 6, timing: measure(rows, policy) }));

  assert.deepEqual(failures, []);
});
