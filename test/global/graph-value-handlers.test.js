import assert from "node:assert/strict";
import { test } from "node:test";
// These handlers are intentionally disconnected from the package build entry points.
import { CjsGraphTypeFloat32 } from "../../src/global/model/graph/types/CjsGraphTypeFloat32.js";
import { CjsGraphTypeFloat64 } from "../../src/global/model/graph/types/CjsGraphTypeFloat64.js";
import { CjsGraphTypeBoolean } from "../../src/global/model/graph/types/CjsGraphTypeBoolean.js";
import { CjsGraphTypeString } from "../../src/global/model/graph/types/CjsGraphTypeString.js";
import { CjsGraphTypeFloat32Array } from "../../src/global/model/graph/types/CjsGraphTypeFloat32Array.js";

test("float Set compares after conversion and invokes ordinary accessors only on changes", () =>
{
  let stored = Math.fround(0.1), writes = 0;
  const target = { get value() { return stored; }, set value(v) { stored = v; writes++; } };
  const handler = new CjsGraphTypeFloat32();

  assert.equal(handler.Set(target, "value", 0.1), false);
  assert.equal(writes, 0);
  assert.equal(handler.Set(target, "value", 0.2), true);
  assert.equal(stored, Math.fround(0.2));
  assert.equal(writes, 1);
  assert.equal(handler.Get(target, "value"), stored);
});

test("exact change detection differs from Carbon scalar tolerance", () =>
{
  const target = { value: 0 };
  assert.equal(CjsGraphTypeFloat32.isEqual(0, Math.fround(1e-7)), true);
  assert.equal(CjsGraphTypeFloat32.set(target, "value", 1e-7), true);
  assert.equal(CjsGraphTypeFloat32.isEqual(0, Math.fround(1e-6)), false);
  assert.equal(CjsGraphTypeFloat32.isEqual(NaN, NaN), false);
  assert.equal(CjsGraphTypeFloat32.isExactEqual(NaN, NaN), true);
  assert.equal(CjsGraphTypeFloat32.set(target, "value", -0), true);
  assert.equal(CjsGraphTypeFloat32.set(target, "value", 0), true);

  assert.equal(CjsGraphTypeFloat64.isEqual(0, 1e-13), true);
  assert.equal(CjsGraphTypeFloat64.isEqual(0, 1e-12), false);
  CjsGraphTypeFloat64.set(target, "value", 1 + 2 ** -40);
  assert.notEqual(target.value, Math.fround(target.value));
});

test("scalar instance shortcuts preserve type conversion without From", () =>
{
  const string = new CjsGraphTypeString(), boolean = new CjsGraphTypeBoolean();
  const source = { value: "hello" }, target = { value: "" };
  assert.equal(string.Copy(source, "value", target, "value"), true);
  assert.equal(string.Clone(target, "value"), "hello");
  assert.equal(string.Copy(source, "value", target, "value"), false);
  assert.equal(boolean.Set(target, "value", 1), true);
  assert.equal(target.value, true);
  assert.equal(boolean.Is(true), true);
  assert.equal(boolean.Is(1), false);
  assert.equal(string.Is("hello"), true);
  assert.equal("From" in string, false);
});

test("array writes reuse storage and compare the Float32 result", () =>
{
  const storage = new Float32Array([0.1, 2, 3]);
  const target = { value: storage };
  const handler = new CjsGraphTypeFloat32Array();
  handler.length = 3;

  assert.equal(handler.Set(target, "value", [0.1, 2, 3]), false);
  assert.equal(handler.Set(target, "value", new Float64Array([0.1, 4, 3])), true);
  assert.equal(target.value, storage);
  assert.deepEqual(handler.Get(target, "value"), [Math.fround(0.1), 4, 3]);
  assert.throws(() => handler.Set(target, "value", [1, 2]), RangeError);
  assert.equal(target.value, storage);
});

test("variable array resize and explicit clone own independent storage", () =>
{
  const original = new Float32Array([1, 2]);
  const target = { value: original };
  assert.equal(CjsGraphTypeFloat32Array.set(target, "value", [1, 2, 3]), true);
  assert.notEqual(target.value, original);
  assert.deepEqual(Array.from(original), [1, 2]);

  const clone = CjsGraphTypeFloat32Array.clone(target, "value");
  clone[0] = 99;
  assert.equal(target.value[0], 1);
});

test("overlapping views copy without corrupting later source elements", () =>
{
  const storage = new Float32Array([1, 2, 3, 4]);
  const target = { value: storage.subarray(1) };
  assert.equal(CjsGraphTypeFloat32Array.set(target, "value", storage.subarray(0, 3)), true);
  assert.deepEqual(Array.from(storage), [1, 1, 2, 3]);
});

test("float-array tolerant comparison preserves Carbon's NaN quirk (CE-202)", () =>
{
  assert.equal(CjsGraphTypeFloat32Array.isEqual(new Float32Array([NaN]), new Float32Array([3])), true);
  assert.equal(CjsGraphTypeFloat32Array.isExactEqual([NaN], [3]), false);
  assert.equal(CjsGraphTypeFloat32Array.isEqual(new Float32Array([0]), new Float32Array([1e-6])), false);
  assert.equal(CjsGraphTypeFloat32Array.isEqual(new Float32Array([0]), new Float32Array([1e-7])), true);
  assert.equal(CjsGraphTypeFloat32Array.isEqual([], [0]), false);
});

test("IsLike compares representations after storage conversion without changing them", () =>
{
  assert.equal(CjsGraphTypeFloat32.isLike("0.1", Math.fround(0.1)), true);
  assert.equal(CjsGraphTypeBoolean.isLike(1, true), true);
  const handler = new CjsGraphTypeFloat32Array();
  handler.length = 2;
  const source = [16777217, 0.1];
  const stored = new Float32Array(source);
  assert.equal(handler.IsLike(source, stored), true);
  assert.equal(handler.IsEqual(source, stored), false);
  assert.equal(handler.IsLike([1], [1]), false);
  assert.deepEqual(source, [16777217, 0.1]);
});

test("IsEqual rejects alternate representations that IsLike accepts", () =>
{
  assert.equal(CjsGraphTypeFloat32.isEqual("1", 1), false);
  assert.equal(CjsGraphTypeFloat64.isEqual("1", 1), false);
  assert.equal(CjsGraphTypeString.isEqual(1, 1), false);
  assert.equal(CjsGraphTypeBoolean.isEqual(1, 1), false);
  assert.equal(CjsGraphTypeFloat32Array.isEqual([1], new Float32Array([1])), false);
});

test("Set and IsLike pass the same property options to conversion", () =>
{
  class ConfiguredFloat extends CjsGraphTypeFloat32
  {
    static convert(value, options) { return Math.fround(Number(value) * options.scale); }
  }
  const target = { value: 0 };
  const options = { scale: 2 };
  assert.equal(ConfiguredFloat.set(target, "value", "3", options), true);
  assert.equal(target.value, 6);
  assert.equal(ConfiguredFloat.isLike("3", 3, options), true);
});
