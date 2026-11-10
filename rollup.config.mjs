import { babel } from "@rollup/plugin-babel";
import json from "@rollup/plugin-json";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isUnshippedSource } from "./scripts/lib/unshipped-source.js";
import { resolveBrowserModule } from "./rollup.browser-shared.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const dependencies = new Set(Object.keys(manifest.dependencies ?? {}));
const unpublishedInputs = new Set([
    "src/trinity/generated/eve/EveDamageOverlay.js",
    "src/trinity/generated/eve/EveModularObjectModifier.js"
]);
// Internal direct-import entries retain their exports when a public barrel
// omits them or their imports alias stays external. CjsBlackRecordReader, the
// payload-shaped Black record reader beside the live readers, has no public entry.
const privateInputs = [ "src/trinityal/webgpu/internal.js", "src/blue/blue.js", "src/blue/exposure/be.js",
    "src/blue/formats/black/BlackReader.js", "src/blue/formats/black/CjsBlackRecordReader.js" ];

function collectTargets(value, out = [])
{
    if (typeof value === "string") out.push(value);
    else if (Array.isArray(value)) value.forEach(entry => collectTargets(entry, out));
    else if (value && typeof value === "object") Object.values(value).forEach(entry => collectTargets(entry, out));
    return out;
}

function collectFiles(directory)
{
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
    {
        const target = path.join(directory, entry.name);
        return entry.isDirectory() ? collectFiles(target) : [ target ];
    });
}

function expandTarget(target)
{
    const star = target.indexOf("*");
    if (star === -1) return [ target.slice(2) ];

    const relativeTarget = target.slice(2);
    const before = relativeTarget.slice(0, relativeTarget.indexOf("*"));
    const directory = path.resolve(root, before.endsWith("/") ? before : path.dirname(before));
    if (!fs.existsSync(directory)) return [];

    const pattern = new RegExp(`^${relativeTarget
        .replace(/[.+?^${}()|[\]\\]/gu, "\\$&")
        .replaceAll("*", ".*")}$`, "u");

    return collectFiles(directory)
        .map(file => path.relative(root, file).replaceAll(path.sep, "/"))
        .filter(file => pattern.test(file));
}

const input = Array.from(new Set([
    ...collectTargets(manifest.exports).flatMap(expandTarget),
    ...privateInputs
]))
    // An export wildcard matches nested directories too, so `./src/character/*.js` would reach the
    // git-ignored donor ports (scripts/lib/unshipped-source.js).
    .filter(target => target.startsWith("src/") && target.endsWith(".js") && !unpublishedInputs.has(target) && !isUnshippedSource(target));

function packageName(id)
{
    const parts = id.split("/");
    return id.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

// Package `#` imports and the dependencies resolve to files, so dist holds only relative paths. A browser
// does not read package.json `imports` or find bare names without an import map, and a module worker does
// not inherit the page's import map: either left in dist fails there (resource.worker.bundle.js importing a
// per-file format module). The dependencies' used ESM files are emitted under dist/node_modules with
// their licences.
const sourceRequire = createRequire(path.join(root, "package.json"));
const packageImports = {
    name: "cjs-package-imports-relative",
    resolveId(source)
    {
        if (source.startsWith("#")) return sourceRequire.resolve(source);
        if (dependencies.has(packageName(source))) return resolveBrowserModule(source);
        return null;
    },
    generateBundle()
    {
        for (const name of dependencies)
        {
            const directory = path.join(root, "node_modules", name);
            const licence = fs.readdirSync(directory).find(file => /^licen[cs]e/iu.test(file));
            if (!licence) throw new Error(`Dependency ${name} ships no licence file to copy into dist.`);
            this.emitFile({ type: "asset", fileName: `node_modules/${name}/${licence}`, source: fs.readFileSync(path.join(directory, licence)) });
        }
    }
};

export default {
    input,
    external: id => id.startsWith("node:"),
    output: {
        // npm/dist, or the staging directory build-npm-staged.js swaps in at the end.
        dir: `${process.env.CJS_NPM_OUT || "npm"}/dist`,
        format: "esm",
        preserveModules: true,
        preserveModulesRoot: "src",
        sourcemap: true
    },
    plugins: [
        packageImports,
        json({ compact: true }),
        babel({
            babelHelpers: "bundled",
            extensions: [ ".js" ],
            exclude: /node_modules/u,
            babelrc: false,
            configFile: false,
            plugins: [
                [ "@babel/plugin-proposal-decorators", { version: "2023-11" } ]
            ]
        })
    ]
};
