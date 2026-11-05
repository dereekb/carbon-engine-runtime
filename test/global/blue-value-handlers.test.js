import assert from "node:assert/strict";
import { test } from "node:test";
// These handlers are intentionally disconnected from the package build entry points.
import { CjsTypeFloat32 } from "../../src/blue/exposure/types/CjsTypeFloat32.js";
import { CjsTypeFloat64 } from "../../src/blue/exposure/types/CjsTypeFloat64.js";
import { CjsTypeBoolean } from "../../src/blue/exposure/types/CjsTypeBoolean.js";
import { CjsTypeString } from "../../src/blue/exposure/types/CjsTypeString.js";
import { CjsTypeFloat32Array } from "../../src/blue/exposure/types/CjsTypeFloat32Array.js";
import { VARTYPE } from "../../src/blue/exposure/BlueTypes.js";

test("float Set compares after conversion and invokes ordinary accessors only on changes", () =>
{
  let stored = Math.fround(0.1), writes = 0;
  const target = { get value() { return stored; }, set value(v) { stored = v; writes++; } };
  const handler = new CjsTypeFloat32();

  assert.equal(handler.varType, VARTYPE.FLOAT);
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
  assert.equal(CjsTypeFloat32.isEqual(0, Math.fround(1e-7)), true);
  assert.equal(CjsTypeFloat32.set(target, "value", 1e-7), true);
  assert.equal(CjsTypeFloat32.isEqual(0, Math.fround(1e-6)), false);
  assert.equal(CjsTypeFloat32.isEqual(NaN, NaN), false);
  assert.equal(CjsTypeFloat32.isExactEqual(NaN, NaN), true);
  assert.equal(CjsTypeFloat32.set(target, "value", -0), true);
  assert.equal(CjsTypeFloat32.set(target, "value", 0), true);

  assert.equal(CjsTypeFloat64.isEqual(0, 1e-13), true);
  assert.equal(CjsTypeFloat64.isEqual(0, 1e-12), false);
  CjsTypeFloat64.set(target, "value", 1 + 2 ** -40);
  assert.notEqual(target.value, Math.fround(target.value));
});

test("scalar instance shortcuts preserve type conversion without From", () =>
{
  const string = new CjsTypeString(), boolean = new CjsTypeBoolean();
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
  const handler = new CjsTypeFloat32Array();
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
  assert.equal(CjsTypeFloat32Array.set(target, "value", [1, 2, 3]), true);
  assert.notEqual(target.value, original);
  assert.deepEqual(Array.from(original), [1, 2]);

  const clone = CjsTypeFloat32Array.clone(target, "value");
  clone[0] = 99;
  assert.equal(target.value[0], 1);
});

test("overlapping views copy without corrupting later source elements", () =>
{
  const storage = new Float32Array([1, 2, 3, 4]);
  const target = { value: storage.subarray(1) };
  assert.equal(CjsTypeFloat32Array.set(target, "value", storage.subarray(0, 3)), true);
  assert.deepEqual(Array.from(storage), [1, 1, 2, 3]);
});

test("float-array tolerant comparison preserves Carbon's NaN quirk (CE-202)", () =>
{
  assert.equal(CjsTypeFloat32Array.isEqual([NaN], [3]), true);
  assert.equal(CjsTypeFloat32Array.isExactEqual([NaN], [3]), false);
  assert.equal(CjsTypeFloat32Array.isEqual([0], [Math.fround(1e-6)]), false);
  assert.equal(CjsTypeFloat32Array.isEqual([0], [Math.fround(1e-7)]), true);
  assert.equal(CjsTypeFloat32Array.isEqual([], [0]), false);
});
