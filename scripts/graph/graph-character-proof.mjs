// Compares the graph with the old values path on the character text files, which hold the Maps of plain values
// the .black corpus does not. Reads each file through CjsCharacterObjectBuilder, then checks get against the old
// values, then from over those values, get against them, diff, a bag with defaults left out, and each Map's keys.
// A number is compared exactly, and one that differs only in float32 rounding is listed by path.
//   node scripts/graph/graph-character-proof.mjs <target> <out.json>
// Needs tools-core on 5510. CJS_GRAPH_DIST points at a private copy of npm (with its package.json) so a long
// run survives a shared build. Writes counts and res: paths only, never game bytes.
import { writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const DIST = join(here, process.env.CJS_GRAPH_DIST ?? "../../npm", "dist");
const load = path => import(pathToFileURL(join(DIST, path)).href);

const [ target, outPath ] = process.argv.slice(2);
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
const { CjsBlueGraph } = await load("blue/formats/graph/index.js");
const { CjsGraph } = await load("global/model/graph/index.js");
const { CjsCharacterObjectBuilder } = await load("character/formats/CjsCharacterObjectBuilder.js");
const { CjsCharacterLibraryConfiguration } = await load("character/library/CjsCharacterLibraryConfiguration.js");

CjsBlueGraph.register(blue.classes);

// BlueVariable's double AreEqual, which SkipEquals uses: a get leaves out what is this close to a default.
const DOUBLE_TOLERANCE = 1e-12;
const reading = { persistOnly: true, typeTags: true, full: true };
const trimmed = { persistOnly: true, typeTags: true };
const stats = { files: 0, unreadable: {}, kinds: {}, examples: {}, rounded: {} };

function note(kind, name, path)
{
  const held = (stats.kinds[kind] ??= { files: 0, get: 0, from: 0, skip: 0, diff: 0, threw: 0, maps: 0, keys: {} });
  if (name) held[name]++;
  if (name) (stats.examples[`${kind} ${name}`] ??= path);
}

/** Exact comparison: these numbers are float64, and a Map compares by its keys and their types. */
function valueDiff(a, b, path = "", near = 0)
{
  if (a === b || (a !== a && b !== b)) return null;
  if (near > 0 && typeof a === "number" && typeof b === "number" && (Math.fround(a) === Math.fround(b) || Math.abs(a - b) < near)) return null;
  if (a instanceof Map || b instanceof Map)
  {
    if (!(a instanceof Map && b instanceof Map) || a.size !== b.size) return path;
    for (const [ key, value ] of a)
    {
      if (!b.has(key)) return `${path}.<key ${typeof key}>`;
      const found = valueDiff(value, b.get(key), `${path}.[]`, near);
      if (found) return found;
    }
    return null;
  }
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return path;
  for (const key of new Set([ ...Object.keys(a), ...Object.keys(b) ]))
  {
    const found = valueDiff(a[key], b[key], `${path}.${key}`, near);
    if (found) return found;
  }
  return null;
}

/** The Map members of a built object, by the keys they hold. */
function getMaps(object)
{
  const maps = {};
  for (const key of Object.keys(object))
  {
    if (object[key] instanceof Map) maps[key] = object[key];
  }
  return maps;
}

function toRegExp(match)
{
  const text = match.replace(/[.+^${}()|[\]\\]/gu, "\\$&").replace(/\*\*/gu, "\u0000").replace(/\*/gu, "[^/]*").replace(/\u0000/gu, ".*");
  return new RegExp(`^${text}$`, "iu");
}

const rows = CjsCharacterLibraryConfiguration.getRows()
  .filter(row => !CjsCharacterLibraryConfiguration.kinds[row.kind].pathOnly)
  .map(row => ({ kind: row.kind, test: toRegExp(row.match) }));

const all = await (await fetch(`${base}resfiles`)).json();

for (const entry of all)
{
  const path = entry.startsWith("res:/") ? entry : `res:/${entry}`;
  const row = rows.find(candidate => candidate.test.test(path));
  if (!row) continue;

  let original;
  try
  {
    const response = await fetch(`${base}res/${path.slice(5)}`);
    if (!response.ok) { stats.unreadable.notServed = (stats.unreadable.notServed ?? 0) + 1; continue; }
    original = new CjsCharacterObjectBuilder(await response.text(), row.kind, path).CreateObject();
  }
  catch (error)
  {
    const reason = String(error.message).slice(0, 70);
    stats.unreadable[reason] = (stats.unreadable[reason] ?? 0) + 1;
    (stats.examples[`unreadable ${reason}`] ??= path);
    continue;
  }

  stats.files++;
  note(row.kind);
  const kind = row.kind;
  stats.kinds[kind].files++;

  try
  {
    const className = CjsSchema.getClassName(original.constructor);
    const values = CjsSchema.getValues(original, {}, reading);

    const built = CjsGraph.from(null, { _type: className, ...values }, { skipEvents: true });
    const bag = CjsGraph.get(built, reading);
    const held = valueDiff(bag, values, "", Number.MIN_VALUE);
    if (held) note(kind, "get", `${path} ${held}`);
    const exact = valueDiff(bag, values);
    if (exact && !held) { stats.rounded[exact.replace(/.d+/gu, ".[]").replace(/.value.[^.]+/gu, ".value.*")] = path; }

    const maps = getMaps(built);
    for (const name of Object.keys(maps))
    {
      stats.kinds[kind].maps++;
      for (const key of maps[name].keys())
      {
        const count = stats.kinds[kind].keys, type = `${name}:${typeof key}`;
        count[type] = (count[type] ?? 0) + 1;
      }
    }

    if (CjsGraph.diff(built, bag)) note(kind, "diff", path);

    const skipped = CjsGraph.from(null, { _type: className, ...CjsGraph.get(built, trimmed) }, { skipEvents: true });
    const heldSkip = valueDiff(CjsGraph.get(skipped, reading), bag, "", DOUBLE_TOLERANCE);
    if (heldSkip) note(kind, "skip", `${path} ${heldSkip}`);
  }
  catch (error)
  {
    const reason = String(error.message).replace(/ member: .*$/u, " member").replace(/property .*$/u, "property").slice(0, 60);
    const held = (stats.kinds[kind].refused ??= {});
    held[reason] = (held[reason] ?? 0) + 1;
    note(kind, "threw", `${path} ${String(error.message).slice(0, 120)}`);
  }
}

writeFileSync(outPath, JSON.stringify(stats, null, 1));
console.log(`done ${target} files ${stats.files}`);
process.exit(0);
