import assert from "node:assert/strict";
import { test } from "node:test";
// These handlers are intentionally disconnected from the package build entry points.
import { CjsFloat32Type } from "../../src/blue/exposure/types/CjsFloat32Type.js";
import { CjsFloat64Type } from "../../src/blue/exposure/types/CjsFloat64Type.js";
import { CjsBooleanType } from "../../src/blue/exposure/types/CjsBooleanType.js";
import { CjsStringType } from "../../src/blue/exposure/types/CjsStringType.js";
import { CjsFloat32ArrayType } from "../../src/blue/exposure/types/CjsFloat32ArrayType.js";
import { VARTYPE } from "../../src/blue/exposure/BlueTypes.js";

test("float Set compares after conversion and invokes ordinary accessors only on changes", () =>
{
  let stored = Math.fround(0.1), writes = 0;
  const target = { get value() { return stored; }, set value(v) { stored = v; writes++; } };
  const handler = new CjsFloat32Type();

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
  assert.equal(CjsFloat32Type.isEqual(0, Math.fround(1e-7)), true);
  assert.equal(CjsFloat32Type.set(target, "value", 1e-7), true);
  assert.equal(CjsFloat32Type.isEqual(0, Math.fround(1e-6)), false);
  assert.equal(CjsFloat32Type.isEqual(NaN, NaN), false);
  assert.equal(CjsFloat32Type.isExactEqual(NaN, NaN), true);
  assert.equal(CjsFloat32Type.set(target, "value", -0), true);
  assert.equal(CjsFloat32Type.set(target, "value", 0), true);

  assert.equal(CjsFloat64Type.isEqual(0, 1e-13), true);
  assert.equal(CjsFloat64Type.isEqual(0, 1e-12), false);
  CjsFloat64Type.set(target, "value", 1 + 2 ** -40);
  assert.notEqual(target.value, Math.fround(target.value));
});

test("scalar instance shortcuts preserve type conversion without From", () =>
{
  const string = new CjsStringType(), boolean = new CjsBooleanType();
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
  const handler = new CjsFloat32ArrayType();
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
  assert.equal(CjsFloat32ArrayType.set(target, "value", [1, 2, 3]), true);
  assert.notEqual(target.value, original);
  assert.deepEqual(Array.from(original), [1, 2]);

  const clone = CjsFloat32ArrayType.clone(target, "value");
  clone[0] = 99;
  assert.equal(target.value[0], 1);
});

test("overlapping views copy without corrupting later source elements", () =>
{
  const storage = new Float32Array([1, 2, 3, 4]);
  const target = { value: storage.subarray(1) };
  assert.equal(CjsFloat32ArrayType.set(target, "value", storage.subarray(0, 3)), true);
  assert.deepEqual(Array.from(storage), [1, 1, 2, 3]);
});

test("float-array tolerant comparison preserves Carbon's NaN quirk (CE-202)", () =>
{
  assert.equal(CjsFloat32ArrayType.isEqual([NaN], [3]), true);
  assert.equal(CjsFloat32ArrayType.isExactEqual([NaN], [3]), false);
  assert.equal(CjsFloat32ArrayType.isEqual([0], [Math.fround(1e-6)]), false);
  assert.equal(CjsFloat32ArrayType.isEqual([0], [Math.fround(1e-7)]), true);
  assert.equal(CjsFloat32ArrayType.isEqual([], [0]), false);
});
