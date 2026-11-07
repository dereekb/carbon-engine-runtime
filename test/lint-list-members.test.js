// Fixture tests for scripts/lint-list-members.js: each flagged case next to an
// allowed form of the same code, so a scanner that flags nothing or everything fails.
import assert from "node:assert/strict";
import test from "node:test";
import { findListMemberHits } from "../scripts/lint-list-members.js";

const hits = body => findListMemberHits(`class A
{
  @type.list("Item")
  native = new BlueList(Item);

  @type.list("Item")
  plain = [];

  @type.array("Item")
  vector = [];

  other = [];

  ${body}
}`, "fixture.js").map(hit => `${hit.kind} ${hit.member}`);

test("assigning a list member after construction is flagged", () =>
{
  assert.deepEqual(hits("Reset() { this.native = []; }"), [ "reassigned native" ]);
  assert.deepEqual(hits("Reset() { this.plain = this.plain.filter(Boolean); }"), [ "reassigned plain" ]);
});

test("the constructor, array members and undeclared members may assign", () =>
{
  assert.deepEqual(hits("constructor() { this.plain = []; }"), []);
  assert.deepEqual(hits("Reset() { this.vector = []; this.other = []; }"), []);
});

test("length and index writes are flagged on a BlueList only", () =>
{
  assert.deepEqual(hits("Reset() { this.native.length = 0; }"), [ "raw native" ]);
  assert.deepEqual(hits("Reset() { this.native[0] = item; }"), [ "raw native" ]);
  assert.deepEqual(hits("Reset() { this.plain.length = 0; this.plain[0] = item; }"), []);
});

test("the list's own methods and a deliberate raw call are allowed", () =>
{
  assert.deepEqual(hits("Reset() { this.native.Clear(); this.native.push(item); }"), []);
  assert.deepEqual(hits("Reset() { Array.prototype.push.call(this.native, item); }"), []);
  assert.deepEqual(hits("Read() { return this.native[0] === this.native.length; }"), []);
});
