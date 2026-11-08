import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { renameRetrying, swapDirectory } from "../../scripts/lib/npm-swap.js";

/** Three sibling directories in a fresh temporary folder: live and staging each hold one marker file. */
function fixture(t, { live = true } = {})
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "npm-swap-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const paths = { live: path.join(dir, "npm"), staging: path.join(dir, "npm.staging"), previous: path.join(dir, "npm.previous") };
  if (live) { fs.mkdirSync(paths.live); fs.writeFileSync(path.join(paths.live, "which"), "old"); }
  fs.mkdirSync(paths.staging);
  fs.writeFileSync(path.join(paths.staging, "which"), "new");
  return paths;
}

const which = dir => fs.readFileSync(path.join(dir, "which"), "utf8");

test("the finished staging tree replaces the live one, and the old tree is removed", t =>
{
  const paths = fixture(t);
  assert.deepEqual(swapDirectory(paths), { previousRemoved: true });
  assert.equal(which(paths.live), "new");
  assert.equal(fs.existsSync(paths.staging), false);
  assert.equal(fs.existsSync(paths.previous), false);
});

test("a first build with no live tree just moves staging in", t =>
{
  const paths = fixture(t, { live: false });
  swapDirectory(paths);
  assert.equal(which(paths.live), "new");
});

test("a leftover previous tree from an interrupted build is cleared first", t =>
{
  const paths = fixture(t);
  fs.mkdirSync(paths.previous);
  fs.writeFileSync(path.join(paths.previous, "which"), "stale");
  swapDirectory(paths);
  assert.equal(which(paths.live), "new");
  assert.equal(fs.existsSync(paths.previous), false);
});

test("a busy rename is retried; any other error is not", t =>
{
  const paths = fixture(t);
  let calls = 0;
  const flaky = (from, to) => { if (++calls < 3) throw Object.assign(new Error("busy"), { code: "EBUSY" }); fs.renameSync(from, to); };
  renameRetrying(paths.staging, path.join(path.dirname(paths.staging), "moved"), { waitMs: 1, renameSync: flaky });
  assert.equal(calls, 3);
  assert.throws(() => renameRetrying(paths.live, paths.previous, { renameSync: () => { throw Object.assign(new Error("gone"), { code: "ENOENT" }); } }), /gone/);
});

test("when staging cannot be moved in, the old tree is put back so the live tree never goes missing", t =>
{
  const paths = fixture(t);
  const failing = (from, to) =>
  {
    if (from === paths.staging) throw Object.assign(new Error("locked"), { code: "EBUSY" });
    fs.renameSync(from, to);
  };
  assert.throws(() => swapDirectory(paths, { attempts: 2, waitMs: 1, renameSync: failing }), /locked/);
  assert.equal(which(paths.live), "old");
  assert.equal(which(paths.staging), "new", "staging is left for inspection");
});
