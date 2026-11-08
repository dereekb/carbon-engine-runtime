// npm run build:npm: builds the npm package into npm.staging/ and swaps it in for npm/ at the end.
//
// build-npm.js starts by deleting its output root, and rollup then writes dist over a few minutes. Built
// straight into npm/, anything reading npm/dist meanwhile (Graphene's server, a test run) finds it missing
// or half written. Built into npm.staging/, npm/ stays whole until two renames swap the finished tree in
// (scripts/lib/npm-swap.js). The gap between them is one rename, not the build. BUILD.lock still serialises
// builds, so the fixed staging names never collide.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { removeDirectory, swapDirectory } from "./lib/npm-swap.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STAGING = process.env.CJS_NPM_STAGING || "npm.staging";
const paths = { live: path.join(root, "npm"), staging: path.join(root, STAGING), previous: path.join(root, "npm.previous") };

/** Runs one build step with the staging root as its output, stopping the build if it fails. */
function step(label, args)
{
    console.log(`build:npm - ${label}`);
    const result = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit", env: { ...process.env, CJS_NPM_OUT: STAGING } });
    if (result.status !== 0) throw new Error(`build:npm stopped at ${label}; npm/ is untouched and ${STAGING}/ is left for inspection`);
}

removeDirectory(paths.staging);
const rollup = path.join(root, "node_modules/rollup/dist/bin/rollup");
step("metadata", [ path.join(root, "scripts/build-npm.js") ]);
step("rollup", [ rollup, "-c" ]);
step("workers", [ rollup, "-c", "rollup.workers.config.mjs" ]);
step("minified bundle", [ path.join(root, "scripts/build-min.js") ]);

// CJS_NPM_NO_SWAP builds into the staging directory only, for checking the build without replacing npm/.
if (process.env.CJS_NPM_NO_SWAP) console.log(`build:npm - built ${STAGING}/; npm/ not replaced`);
else
{
    const { previousRemoved } = swapDirectory(paths);
    if (!previousRemoved) console.warn("build:npm - npm.previous/ could not be removed; the next build removes it");
    console.log("build:npm - npm/ replaced");
}
