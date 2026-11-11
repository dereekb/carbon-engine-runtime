import test from "node:test";
import { assertNoComputeTeardown } from "../support/noComputeDestruct.js";

test("particle-system public destruction releases its owned no-compute helper", t =>
{
  assertNoComputeTeardown(t, true);
});
