import test from "node:test";
import { assertNoComputeTeardown } from "../support/noComputeDestruct.js";

test("no-compute helper releases its owned resources and preserves copied shares", t =>
{
  assertNoComputeTeardown(t, false);
});
