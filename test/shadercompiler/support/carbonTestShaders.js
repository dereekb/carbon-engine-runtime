// Reads the HLSL sources embedded in Carbon's own shader compiler tests
// (trinity/shadercompiler/tests/*.cpp, raw string literals), from the local
// Carbon checkout. The sources stay in Carbon's repository; a missing checkout
// fails, as every Carbon-backed check does.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { requireCarbonRoot } from "../../../scripts/lib/carbon-root.js";

// The tests directory in the CARBON_ROOT checkout, unless CARBON_SHADERCOMPILER_TESTS names one.
const TESTS_DIR = process.env.CARBON_SHADERCOMPILER_TESTS ?? join(requireCarbonRoot(), "trinity/shadercompiler/tests");

/**
 * Checks the Carbon-backed tests can run. They never skip: a missing checkout fails.
 *
 * @returns {false} No skip reason, so callers passing it as `skip` run the test.
 * @throws {Error} When the tests directory is missing.
 */
export function carbonTestsSkipReason()
{
    if (!existsSync(TESTS_DIR)) throw new Error(`Carbon shader compiler tests not found at ${TESTS_DIR}: set CARBON_ROOT or CARBON_SHADERCOMPILER_TESTS.`);
    return false;
}

/**
 * Every raw string literal in Carbon's compiler tests, with the test it
 * belongs to.
 *
 * @returns {Array<{ file: string, test: string, source: string }>} The sources, `source` as written (it starts with a newline).
 */
export function carbonTestShaders()
{
    const result = [];
    for (const file of readdirSync(TESTS_DIR).filter(name => name.endsWith(".cpp")).sort())
    {
        const text = readFileSync(join(TESTS_DIR, file), "utf8").replace(/\r\n/gu, "\n");
        const literal = /R"(\w*)\(([\s\S]*?)\)\1"/gu;
        for (let match = literal.exec(text); match; match = literal.exec(text))
        {
            const before = text.slice(0, match.index);
            const tests = [...before.matchAll(/(?:TYPED_)?TEST\(\s*(\w+),\s*(\w+)\s*\)/gu)];
            const test = tests.length ? `${tests.at(-1)[1]}.${tests.at(-1)[2]}` : "(file scope)";
            result.push({ file, test, source: match[2] });
        }
    }
    return result;
}
