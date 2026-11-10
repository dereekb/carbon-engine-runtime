import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("published source is organization-independent and browser-safe", async () =>
{
    // The published source is what git keeps: tracked files and new ones not yet added, never an ignored local
    // workspace (src/character/carbon-donor/, a side-by-side port that is never committed, imported or exported).
    const listed = spawnSync("git", [ "ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", "src" ], { cwd: packageRoot, encoding: "utf8" });
    assert.equal(listed.status, 0, listed.stderr);
    const files = [ ...new Set(listed.stdout.split("\0").filter(file => file.endsWith(".js"))) ]
        .map(file => path.join(packageRoot, file))
        .filter(file => existsSync(file));
    assert.ok(files.length > 1000, `git listed only ${files.length} source files`);

    for (const file of files)
    {
        const source = await fs.readFile(file, "utf8");
        const code = source
            .replace(/\/\*[\s\S]*?\*\//gu, "")
            .replace(/^[ \t]*\/\/.*$/gmu, "");

        assert.doesNotMatch(code, /from\s+["']@carbonenginejs\//u, file);
        assert.doesNotMatch(code, /import\s*\(\s*["']@carbonenginejs\//u, file);
        assert.doesNotMatch(code, /from\s+["']node:/u, file);
        assert.doesNotMatch(code, /import\s*\(\s*["'`]node:/u, file);
        assert.doesNotMatch(code, /\bprocess\.(?:env|argv|platform|cwd|exit|versions)\b/u, file);
        assert.doesNotMatch(code, /new\s+Function\s*\([^)]*import\s*\(/u, file);

        for (const line of code.split("\n"))
        {
            const callsBuffer = /\bnew\s+Buffer\b|\bBuffer\s*\.\s*(?:from|alloc|allocUnsafe|concat|isBuffer)\b/u.test(line);
            assert.equal(callsBuffer && !/typeof\s+Buffer/u.test(line), false, file);
        }
    }
});

test("every built advertised subpath imports independently", async () =>
{
    const npmRoot = path.join(packageRoot, "npm");
    const manifest = JSON.parse(await fs.readFile(path.join(npmRoot, "package.json"), "utf8"));

    for (const [ name, target ] of Object.entries(manifest.exports))
    {
        if (name.includes("*") || typeof target !== "string" || !target.endsWith(".js")) continue;
        const module = await import(pathToFileURL(path.resolve(npmRoot, target)).href);

        assert.equal(typeof module, "object", name);
    }
});

test("directory-backed internal aliases resolve to concrete foundation fronts", async () =>
{
    const aliases = [
        "#utils/errors",
        "#utils/resfile",
        "#consts/media",
        "#consts/graphics",
        "#consts/render-context",
        "#consts/audio",
        "#consts/shader",
        "#consts/d3d",
        "#schema/types",
        "#model/hydration",
        "#model/lifecycle"
    ];

    for (const name of aliases)
    {
        const module = await import(name);

        assert.ok(Object.keys(module).length > 0, name);
    }

    const types = await import("#schema/types");
    assert.equal("CjsSchema" in types, false, "#schema/types remains descriptor-only");
});
