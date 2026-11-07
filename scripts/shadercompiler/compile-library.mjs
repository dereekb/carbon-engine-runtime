// Compiles every effect in the shader library for WebGPU and WebGL2 and writes
// the containers as the engine asks for them:
//
//   node scripts/shadercompiler/compile-library.mjs <out directory>
//
// `library/<dir>/<name>.fx` becomes `<out>/graphics/effect.<tree>/cjs/<dir>/<name>.<sm>`
// in the `webgpu` and `webgl` trees (Tr2Effect.convertEffectPath looks in
// `effect.<backend.target>`), for each of `.sm_hi`, `.sm_lo` and `.sm_depth`.
// Trinity picks the suffix from
// one renderer-wide shader model (Tr2Effect.cpp:353-363); the library's
// effects do not vary by it, so the three files hold the same container. An
// effect is referenced as `res:/graphics/effect/cjs/<dir>/<name>.fx`, which
// ResolveEffectPath (global/utils/effectPath.js) maps to these files. The
// output folder is what a tools-core overlay imports to serve them.
//
// WebGL2's printer does not take the whole library yet, and has no compute
// stage at all. An effect it refuses is left out of `effect.webgl`, which the
// path lookup then misses as it does today, and is reported.

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CompileEffectFile } from "../../src/resource/shader/compiler/ShaderCompiler/shaderCompiler.js";
import { Platform } from "../../src/resource/shader/compiler/platforms.js";
import { Macro } from "../../src/resource/shader/compiler/Macro.js";
import { CjsFxEffectCompilerWebGPU } from "../../src/resource/shader/compiler/EffectCompilerWebGPU/index.js";
import { CjsFxEffectCompilerWebGL2 } from "../../src/resource/shader/compiler/EffectCompilerWebGL2/index.js";
import { LIBRARY_ROOT } from "./cbuffer-headers.mjs";

/** The containers each effect is written as. */
const SHADER_MODELS = ["sm_hi", "sm_lo", "sm_depth"];

/**
 * Whether an effect stands in for shipped compute on a backend without it, so
 * WebGPU, which runs the shipped effects, has no use for it.
 *
 * @param {string} effect The `.fx` path, with or without its leading slash.
 * @returns {boolean} Whether only WebGL2 draws it.
 */
export function isWebgl2OnlyEffect(effect)
{
    return effect.replace(/^\//u, "").startsWith("specialfx/gpuparticles/");
}

/** The trees written, each from its compiler; `required` fails the build when an effect does not compile. */
const TARGETS = [
    { tree: "effect.webgpu", required: true, defines: [], compilers: new Map([[Platform.PLATFORM_WEBGPU, session => new CjsFxEffectCompilerWebGPU(session)]]) },
    { tree: "effect.webgl", required: false, defines: [new Macro("PLATFORM", "webgl2")], compilers: new Map([[Platform.PLATFORM_WEBGL2, session => new CjsFxEffectCompilerWebGL2(session)]]) }
];

/**
 * Every effect file under a directory, as paths relative to it.
 *
 * @param {string} directory The library directory.
 * @returns {string[]} The `.fx` paths, with forward slashes.
 */
function effectFiles(directory)
{
    const found = [];
    const walk = current =>
    {
        for (const name of readdirSync(current))
        {
            const path = join(current, name);
            if (statSync(path).isDirectory())
            {
                walk(path);
            }
            else if (name.endsWith(".fx"))
            {
                found.push(relative(directory, path).split("\\").join("/"));
            }
        }
    };
    walk(directory);
    return found.sort();
}

/**
 * Compiles the library into `outDirectory`.
 *
 * @param {string} outDirectory Where `graphics/effect.<tree>/...` is written.
 * @param {string[]} [effects] The `.fx` paths to compile, relative to the library; every one in it by default.
 * @param {(tree: string, effect: string, reason: string) => void} [onSkipped] Told of each effect left out of a tree.
 * @returns {{ path: string, bytes: number }[]} The files written, by logical path.
 */
export function compileLibrary(outDirectory, effects = effectFiles(LIBRARY_ROOT), onSkipped = () => {})
{
    const read = path =>
    {
        const file = join(LIBRARY_ROOT, path.replace(/^\//u, ""));
        return existsSync(file) ? readFileSync(file, "utf8") : null;
    };
    const written = [];
    for (const { tree, required, defines, compilers } of TARGETS)
    {
        for (const effect of effects)
        {
            if (tree === "effect.webgpu" && isWebgl2OnlyEffect(effect))
            {
                continue;
            }
            let bytes;
            let reason;
            try
            {
                const compiled = CompileEffectFile(`/${effect}`, { read, compilers, defines });
                bytes = compiled.bytes;
                reason = compiled.messages.join("\n");
            }
            catch (error)
            {
                // A printer refuses what it cannot print by throwing.
                if (required)
                {
                    throw error;
                }
                reason = error.message;
            }
            if (!bytes)
            {
                if (required)
                {
                    throw new Error(`${effect} did not compile:\n${reason}`);
                }
                onSkipped(tree, effect, reason);
                continue;
            }
            const base = effect.replace(/\.fx$/u, "");
            for (const model of SHADER_MODELS)
            {
                const path = `graphics/${tree}/cjs/${base}.${model}`;
                const file = join(outDirectory, path);
                mkdirSync(dirname(file), { recursive: true });
                writeFileSync(file, bytes);
                written.push({ path, bytes: bytes.length });
            }
        }
    }
    return written;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
{
    const out = process.argv[2];
    if (!out)
    {
        console.error("usage: node scripts/shadercompiler/compile-library.mjs <out directory>");
        process.exit(1);
    }
    const skipped = (tree, effect, reason) => console.log(`skipped ${tree} ${effect}: ${reason}`);
    for (const { path, bytes } of compileLibrary(resolve(out), undefined, skipped))
    {
        console.log(`res:/${path} (${bytes} bytes)`);
    }
}
