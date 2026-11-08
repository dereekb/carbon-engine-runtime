// The Carbon source checkout, from CARBON_ROOT.
//
// A missing or wrong setting fails. A check that fell back to a guessed path,
// or skipped when it found no checkout, reported a pass it had not earned.

import { existsSync } from "node:fs";

/**
 * The Carbon source checkout CARBON_ROOT names.
 *
 * @returns {string} The directory.
 * @throws {Error} When CARBON_ROOT is unset or names no directory.
 */
export function requireCarbonRoot()
{
    const root = process.env.CARBON_ROOT;
    if (!root) throw new Error("Set CARBON_ROOT to the Carbon source checkout.");
    if (!existsSync(root)) throw new Error(`CARBON_ROOT names no directory: ${root}`);
    return root;
}
