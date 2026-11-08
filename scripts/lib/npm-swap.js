// Swaps a finished build directory in for the live one with two renames, so readers never see a partial tree.
import fs from "node:fs";

/** Error codes Windows reports while something holds a handle in, or has its working directory inside, a tree. */
const BUSY = new Set([ "EBUSY", "EPERM", "EACCES" ]);

/**
 * Renames a directory, retrying while it is busy.
 *
 * @param {string} from Current path.
 * @param {string} to New path.
 * @param {{ attempts?: number, waitMs?: number, renameSync?: Function }} [options] Retry policy; renameSync for tests.
 */
export function renameRetrying(from, to, { attempts = 20, waitMs = 250, renameSync = fs.renameSync } = {})
{
    for (let attempt = 1; ; attempt++)
    {
        try
        {
            renameSync(from, to);
            return;
        }
        catch (error)
        {
            if (attempt >= attempts || !BUSY.has(error.code)) throw error;
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, waitMs);
        }
    }
}

/**
 * Removes a directory, refusing a link: removing a junction's contents deletes its target's files.
 *
 * @param {string} dir The directory.
 */
export function removeDirectory(dir)
{
    if (!fs.existsSync(dir)) return;
    if (fs.lstatSync(dir).isSymbolicLink()) throw new Error(`Refusing to remove the linked directory ${dir}`);
    fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * Puts `staging` where `live` is: `live` -> `previous`, then `staging` -> `live`, then removes `previous`.
 * When the second rename fails, `previous` is moved back, so `live` is never left missing.
 *
 * @param {{ live: string, staging: string, previous: string }} paths The three directories.
 * @param {object} [options] Passed to renameRetrying.
 * @returns {{ previousRemoved: boolean }} Whether the old tree was removed (a later swap removes it otherwise).
 */
export function swapDirectory({ live, staging, previous }, options = {})
{
    if (fs.existsSync(live) && fs.lstatSync(live).isSymbolicLink()) throw new Error(`Refusing to replace the linked directory ${live}`);
    removeDirectory(previous);
    if (fs.existsSync(live)) renameRetrying(live, previous, options);
    try { renameRetrying(staging, live, options); }
    catch (error)
    {
        if (fs.existsSync(previous) && !fs.existsSync(live)) renameRetrying(previous, live, options);
        throw error;
    }
    try { removeDirectory(previous); }
    catch { return { previousRemoved: false }; }
    return { previousRemoved: true };
}
