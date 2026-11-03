import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { rollup } from "rollup";
import { babel } from "@rollup/plugin-babel";
import json from "@rollup/plugin-json";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sourceScratch = path.join(root, ".scratch", "character-decorator-transform-proof");
const distScratch = path.join(root, "npm", ".scratch", "character-decorator-transform-proof");
const sourceEntry = path.join(sourceScratch, "source-entry.mjs");
const sourceBundle = path.join(sourceScratch, "source-bundle.mjs");
const distEntry = path.join(distScratch, "dist-entry.mjs");
const distBundle = path.join(distScratch, "dist-bundle.mjs");

function entryText(kind) {
  const base = kind === "source" ? "../../src/character/index.js" : "../../dist/character/index.js";
  return `
import { CjsSchema, meta } from "#schema";
import * as character from "${base}";

// The composition half of the proof (the @meta.values installer): pins that
// Babel's 2023-11 class-decorator output applies prototype mutations to the
// SAME prototype object in both pipelines - which schema metadata cannot see.
export function captureComposition() {
  @meta.values
  class ValuesProbe {}
  const proto = ValuesProbe.prototype;
  const result = {
    ownNames: Object.getOwnPropertyNames(proto).sort(),
    // No extends: nothing re-inherited the surface.
    baseIsObject: Object.getPrototypeOf(proto) === Object.prototype,
    methods: {}
  };
  for (const name of ["GetValues", "SetValues", "UpdateValues", "OnModified", "IsDirty", "MarkDirty"]) {
    const fn = proto[name];
    // fn.length catches default-parameter arity drift under transform.
    result.methods[name] = { type: typeof fn, length: fn?.length ?? -1, name: fn?.name ?? null };
  }

  // Behavioural round-trip through the installed dirty flag.
  const instance = new ValuesProbe();
  result.dirtyBefore = instance.IsDirty();
  instance.MarkDirty();
  result.dirtyAfter = instance.IsDirty();

  // Install-if-absent: a class declaring its own OnModified keeps it. The
  // functional form also verifies direct installation independently of the
  // decorated local probe transformed in both source and dist pipelines.
  class OwnOnModifiedProbe {
    OnModified() { return "own"; }
  }
  meta.values(OwnOnModifiedProbe);
  result.ownMethodSurvives = new OwnOnModifiedProbe().OnModified() === "own";
  result.probeGainsRest = typeof OwnOnModifiedProbe.prototype.SetValues === "function";

  return structuredClone(result);
}

export function capture() {
  const entries = [];

  for (const [name, Class] of Object.entries(character)) {
    const schema = typeof Class === "function" ? CjsSchema.getSchema(Class) : null;

    if (!schema?.className) continue;

    const value = new Class();
    entries.push([name, {
      className: schema.className,
      fields: schema.fields.map(field => ({
        name: field.name,
        type: field.type,
        persist: field.edit?.persist === true,
        value: value[field.name]
      }))
    }]);
  }

  // Owned children point back at their owner (a paper doll item's _owner), so
  // an object met again is recorded by its class name instead of re-walked.
  const seen = new WeakSet();
  return JSON.parse(JSON.stringify(Object.fromEntries(entries), (_key, value) => {
    if (value && typeof value === "object" && !ArrayBuffer.isView(value))
    {
      if (seen.has(value)) return "[seen " + (CjsSchema.getClassName(value.constructor) ?? "object") + "]";
      seen.add(value);
    }
    if (value instanceof Map) return Object.fromEntries(value);
    if (ArrayBuffer.isView(value)) return Array.from(value);
    return value;
  }));
}
`;
}

async function writeEntries() {
  await fs.mkdir(sourceScratch, { recursive: true });
  await fs.mkdir(distScratch, { recursive: true });
  await fs.writeFile(sourceEntry, entryText("source"), "utf8");
  await fs.writeFile(distEntry, entryText("dist"), "utf8");
}

async function buildBundle(kind) {
  const source = kind === "source";
  const bundle = await rollup({
    input: source ? sourceEntry : distEntry,
    // Rendering dependencies also contain decorators. Resolve package aliases
    // into this source graph so Babel transforms those modules too, rather
    // than letting Node import raw decorated source behind an external alias.
    external: id => source
      ? !id.startsWith("#") && !id.startsWith(".") && !path.isAbsolute(id)
      : id !== distEntry,
    plugins: [
      json({ compact: true }),
      {
        name: "runtime-source-imports",
        resolveId(id) {
          return source && id.startsWith("#") ? fileURLToPath(import.meta.resolve(id)) : null;
        }
      },
      babel({
        babelHelpers: "bundled",
        extensions: [".js", ".mjs"],
        babelrc: false,
        configFile: false,
        plugins: [["@babel/plugin-proposal-decorators", { version: "2023-11" }]]
      })
    ]
  });

  await bundle.write({ dir: source ? sourceScratch : distScratch, entryFileNames: source ? "source-bundle.mjs" : "dist-bundle.mjs", chunkFileNames: "[name]-[hash].mjs", format: "esm", sourcemap: false });
  await bundle.close();
}

await writeEntries();
await buildBundle("source");
await buildBundle("dist");

const source = await import(pathToFileURL(sourceBundle));
const dist = await import(pathToFileURL(distBundle));
assert.deepEqual(structuredClone(source.capture()), structuredClone(dist.capture()));
assert.deepEqual(source.captureComposition(), dist.captureComposition());
assert.equal(dist.captureComposition().baseIsObject, true, "the extends is gone in dist");
assert.equal(dist.captureComposition().dirtyAfter, true, "composed values surface works in dist");
console.log("decorator transform proof passed for all decorated character classes, including the installed values surface");
