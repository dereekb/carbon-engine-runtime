import assert from "node:assert/strict";
import test from "node:test";
import { EveCurveLineSet } from "../../npm/dist/trinity/index.js";

test("Eve curve-line-set destruction releases at both levels, as Carbon's non-overriding destructor does", t =>
{
  // EveCurveLineSet.cpp:39-43 and Tr2CurveLineSet.cpp:37-40 each call ReleaseResources(TRISTORAGE_ALL).
  const lines = new EveCurveLineSet();
  const release = t.mock.method(lines, "ReleaseResources");
  lines.Destruct();
  assert.equal(release.mock.callCount(), 2);
  release.mock.restore();
  lines.Destruct();
  lines.Destruct();
});
