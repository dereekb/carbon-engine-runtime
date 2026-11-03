import assert from "node:assert/strict";
import { test } from "node:test";
import { CjsLibrary } from "../../../npm/dist/core/index.js";
import * as CjsCoreModule from "../../../npm/dist/core/index.js";

// Service startup, rollback and shutdown contracts are exercised in
// test/blue/blue-services.test.js; this test preserves the public root identity.

test("the core package exports CjsLibrary as its named root, with no default", () =>
{
  assert.equal(typeof CjsLibrary, "function");
  assert.equal("default" in CjsCoreModule, false);
  assert.equal(new CjsLibrary() instanceof CjsLibrary, true);
});
