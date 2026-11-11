import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { TriPoolAllocator } from "../../npm/dist/trinity/index.js";

test("pool destruction releases active and overflow storage while preserving retained views", {
  skip: typeof globalThis.gc !== "function" && "requires node --expose-gc"
}, async () =>
{
  const pool = new TriPoolAllocator({ chunkFloats: 4 });
  pool.RegisterStruct("Value", [{ name: "value", size: 4, encoding: TriPoolAllocator.Type.VECTOR }]);
  const records = Array.from({ length: 3 }, () => new WeakRef(pool.Allocate("Value").GetData().buffer));
  const retained = pool.Allocate("Value").GetData();
  retained.fill(7);
  records.push(new WeakRef(pool.Allocate("Value").GetData().buffer));
  await setImmediate();
  globalThis.gc();
  assert.ok(records.every(record => record.deref()), "the live pool retains active and overflow storage");
  pool.Destruct();
  pool.Destruct();
  for (let attempt = 0; attempt < 3; attempt++)
  {
    await setImmediate();
    globalThis.gc();
  }
  assert.ok(records.every(record => record.deref() === undefined), "destroyed pool retains no active or overflow backing buffers");
  assert.deepEqual(Array.from(retained), [7, 7, 7, 7]);
  assert.equal(pool.Has("Value"), true, "layout policy is unchanged and the pool itself is still strongly held");
});
