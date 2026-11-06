import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import * as types from "../../src/global/model/graph/types/index.js";

const numericArrays = [Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array,
    Int32Array, Uint32Array, Float32Array, Float64Array];
const bigArrays = [BigInt64Array, BigUint64Array];
const numberInputs = [0, -0, 0.1, -0.1, 1.5, 2.5, 3.5, 254.5, 255.5, -129, 128, 255, 256,
    -32769, 32768, 65535, 65536, -(2 ** 31) - 1, 2 ** 31, 2 ** 32 - 1, 2 ** 32,
    16777217, Number.MAX_VALUE, Number.MIN_VALUE, NaN, Infinity, -Infinity, "3", null, true];
const bigInputs = [0n, -1n, 1n, 2n ** 63n - 1n, 2n ** 63n, 2n ** 64n - 1n, 2n ** 64n,
    -(2n ** 64n) - 1n, "9007199254740993", "-9223372036854775809", true, false];

test("integer scalar conversion matches native width without allocating typed scratch storage", () =>
{
    for (const ctor of [Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array])
    {
        const handler = types[`CjsGraphType${ctor.name.slice(0, -5)}`];
        const instance = new handler();
        assert.equal(instance.ctor, Number);
        for (const input of numberInputs)
        {
            const expected = new ctor([input])[0];
            const target = { value: expected };
            assert.equal(handler.convert(input), expected, `${ctor.name}: ${String(input)}`);
            assert.equal(instance.Set(target, "value", input), false);
            assert.equal(instance.Is(expected), true);
            assert.equal(instance.IsEqual(expected, expected), true);
            assert.equal(instance.IsLike(input, expected), true);
            assert.equal(instance.Get(target, "value"), expected);
            assert.equal(instance.Clone(target, "value"), expected);
        }
        assert.equal(instance.Is(0.5), false);
        assert.equal(instance.Is("1"), false);
        assert.equal(instance.Is(NaN), false);
        assert.equal(instance.Is(Infinity), false);
        assert.equal(instance.IsEqual("1", 1), false);
    }
    assert.equal(types.CjsGraphTypeInt8.is(128), false);
    assert.equal(types.CjsGraphTypeUint8.is(-1), false);
    assert.equal(types.CjsGraphTypeInt16.is(32768), false);
    assert.equal(types.CjsGraphTypeUint16.is(65536), false);
    assert.equal(types.CjsGraphTypeInt32.is(2 ** 31), false);
    assert.equal(types.CjsGraphTypeUint32.is(2 ** 32), false);
});

test("64-bit scalar handlers preserve BigInt precision, range and native input conversion", () =>
{
    for (const [handler, ctor] of [[types.CjsGraphTypeInt64, BigInt64Array], [types.CjsGraphTypeUint64, BigUint64Array]])
    {
        const instance = new handler();
        assert.equal(instance.ctor, BigInt);
        for (const input of bigInputs)
        {
            const expected = new ctor([input])[0];
            const target = { value: expected };
            assert.equal(handler.convert(input), expected);
            assert.equal(instance.Set(target, "value", input), false);
            assert.equal(instance.Is(expected), true);
            assert.equal(instance.IsLike(input, expected), true);
        }
        assert.equal(handler.is(1), false);
        assert.equal(handler.is(2n ** 64n), false);
        assert.equal(handler.is("1"), true, "JSON writes 64-bit values as strings");
        assert.equal(handler.is("1.5"), false);
        assert.equal(handler.is("0x10"), false);
        assert.equal(handler.is(""), false);
        assert.equal(handler.is(String(2n ** 64n)), false);
        assert.equal(handler.is([ 1, 2 ]), true, "a [high, low] pair is valid input");
        assert.equal(handler.is([ 1 ]), false);
        assert.equal(handler.is([ 1, 2, 3 ]), false);
        assert.equal(handler.is([ 1.5, 0 ]), false);
        assert.equal(handler.is([ 2 ** 32, 0 ]), false);
        assert.equal(handler.is([ -(2 ** 31) - 1, 0 ]), false);
        assert.equal(handler.is([ "1", 2 ]), false);
        assert.equal(handler.isEqual("1", "1"), false, "valid input is not a canonical value");
        assert.equal(handler.isEqual(1n, 1n), true);
        assert.equal(handler.isEqual(1, 1n), false);
        assert.throws(() => handler.convert(1), TypeError);
        assert.throws(() => handler.convert(1.5), TypeError);
        assert.throws(() => handler.convert("1.5"), SyntaxError);
    }
    const source = { value: 9007199254740993n }, target = { value: 0n };
    assert.equal(types.CjsGraphTypeInt64.copy(source, "value", target, "value"), true);
    assert.equal(target.value, 9007199254740993n);
    assert.equal(types.CjsGraphTypeUint64.is(-1n), false);
    assert.equal(types.CjsGraphTypeInt64.is(2n ** 63n), false);
});

test("Int64 and Uint64 store a [high, low] pair as the canonical BigInt", () =>
{
    const signed = { value: 0n }, unsigned = { value: 0n };

    assert.equal(types.CjsGraphTypeInt64.set(signed, "value", [ 1, 2 ]), true);
    assert.equal(signed.value, (1n << 32n) + 2n);
    assert.equal(types.CjsGraphTypeInt64.set(signed, "value", [ 1, 2 ]), false, "an equal pair is no change");

    assert.equal(types.CjsGraphTypeUint64.set(unsigned, "value", [ 0x80000000, 0 ]), true);
    assert.equal(unsigned.value, 1n << 63n);

    // The low word never borrows from the high word.
    assert.equal(types.CjsGraphTypeUint64.convert([ 0, 0xFFFFFFFF ]), 0xFFFFFFFFn);
    assert.equal(types.CjsGraphTypeUint64.convert([ 0, -1 ]), 0xFFFFFFFFn);

    // The same bits read through each definition's signedness.
    assert.equal(types.CjsGraphTypeInt64.convert([ 0xFFFFFFFF, 0xFFFFFFFF ]), -1n);
    assert.equal(types.CjsGraphTypeInt64.convert([ -1, -1 ]), -1n);
    assert.equal(types.CjsGraphTypeUint64.convert([ 0xFFFFFFFF, 0xFFFFFFFF ]), 2n ** 64n - 1n);

    assert.equal(types.CjsGraphTypeInt64.get(signed, "value"), (1n << 32n) + 2n, "Get writes the canonical form");
    assert.equal(types.CjsGraphTypeInt64.isLike([ 1, 2 ], (1n << 32n) + 2n), true);
    assert.equal(types.CjsGraphTypeInt64.isEqual([ 1, 2 ], (1n << 32n) + 2n), false);
});

test("every array handler takes a plain array through Is and Set, keeping its storage", () =>
{
    const handlers = Object.values(types).filter(handler => handler.prototype instanceof types.CjsGraphTypeArray);
    assert.equal(handlers.length, 21);

    for (const handler of handlers)
    {
        const count = handler.elementCount || 3;
        const big = handler.ctor === BigInt64Array || handler.ctor === BigUint64Array;
        const plain = Array.from({ length: count }, (_, index) => big ? BigInt(index + 1) : index + 1);
        const name = handler.className;
        const storage = new handler.ctor(count), target = { value: storage };

        assert.equal(handler.is(plain), true, name);
        assert.equal(handler.set(target, "value", plain), true, name);
        assert.equal(target.value, storage, name);
        assert.deepEqual(Array.from(storage), plain, name);
        assert.equal(handler.set(target, "value", plain), false, name);
        assert.deepEqual(handler.get(target, "value"), plain, name);
        assert.equal(handler.isLike(plain, storage), handler.hasValueEquality, name);
        assert.equal(handler.is(plain.slice(1)), handler.elementCount === 0, name);
    }
});

for (const ctor of bigArrays)
{
    test(`${ctor.name}: a plain array of strings and [high, low] pairs stores canonical values`, () =>
    {
        const handler = types[`CjsGraphType${ctor.name}`];
        const storage = new ctor(3), target = { value: storage };
        const plain = [ "5", [ 1, 2 ], 7n ];
        const expected = [ 5n, (1n << 32n) + 2n, 7n ];

        assert.equal(handler.is(plain), true);
        assert.equal(handler.set(target, "value", plain), true);
        assert.equal(target.value, storage);
        assert.deepEqual(Array.from(storage), expected);
        assert.equal(handler.set(target, "value", plain), false);

        // A variable length change allocates replacement storage through the same path.
        assert.equal(handler.set(target, "value", [ [ 0, 9 ] ]), true);
        assert.notEqual(target.value, storage);
        assert.deepEqual(Array.from(target.value), [ 9n ]);
        assert.equal(handler.is([ 1, 2 ]), false, "number elements are not 64-bit input, and a pair is not a whole array");
    });
}

for (const ctor of [...numericArrays, ...bigArrays])
{
    test(`${ctor.name}: native conversion, fixed storage, resize, clone and cross-realm detection`, () =>
    {
        const handler = types[`CjsGraphType${ctor.name}`];
        const instance = new handler();
        const inputs = bigArrays.includes(ctor) ? bigInputs : numberInputs;
        const expected = new ctor(inputs);
        const target = { value: new ctor(expected) }, storage = target.value;
        instance.length = inputs.length;
        assert.equal(instance.ctor, ctor);
        assert.equal(instance.Set(target, "value", inputs), false, "change detection uses destination conversion");
        assert.equal(target.value, storage);
        assert.deepEqual(instance.Get(target, "value"), Array.from(expected));
        for (let i = 0; i < inputs.length; i++) assert.equal(handler.convert(inputs[i]), expected[i]);

        const zeros = new ctor(inputs.length);
        assert.equal(instance.Set(target, "value", zeros), true);
        assert.equal(target.value, storage);
        assert.equal(instance.Copy({ value: expected }, "value", target, "value"), true);
        assert.deepEqual(target.value, expected);
        const clone = instance.Clone(target, "value");
        assert.equal(clone.constructor, ctor);
        assert.notEqual(clone.buffer, storage.buffer);
        assert.deepEqual(clone, storage);
        assert.equal(handler.set(target, "value", []), true, "variable-length resize creates owned storage");
        assert.equal(target.value.constructor, ctor);
        assert.equal(target.value.length, 0);
        assert.notEqual(target.value, storage);
        assert.equal(handler.set(target, "value", inputs), true);
        assert.deepEqual(target.value, expected);

        assert.equal(instance.Is(storage), true);
        assert.equal(instance.Is(Array.from(storage)), true, "a plain array is valid input");
        assert.equal(instance.Is([ "not a number" ]), false);
        assert.equal(instance.Is([ undefined ]), false);
        assert.equal(instance.Is(new DataView(new ArrayBuffer(8))), false);
        assert.equal(instance.Is(runInNewContext(`new ${ctor.name}(2)`)), true);
        assert.equal(instance.Is(new (bigArrays.includes(ctor) ? Float32Array : BigInt64Array)(2)), false);
    });

    test(`${ctor.name}: aliased copies preserve unread source elements`, () =>
    {
        const handler = types[`CjsGraphType${ctor.name}`];
        const bigint = bigArrays.includes(ctor);
        const initial = bigint ? [1n, 2n, 3n, 4n] : [1, 2, 3, 4];
        const storage = new ctor(initial);
        const target = { value: storage.subarray(1) };
        assert.equal(handler.set(target, "value", storage.subarray(0, 3)), true);
        assert.deepEqual(Array.from(storage), bigint ? [1n, 1n, 2n, 3n] : [1, 1, 2, 3]);
        assert.equal(handler.set({ value: storage.subarray(0, 3) }, "value", storage.subarray(1)), true);
        assert.deepEqual(Array.from(storage), bigint ? [1n, 2n, 3n, 3n] : [1, 2, 3, 3]);
    });
}

test("clamped bytes round halfway values to even instead of wrapping or rounding upward", () =>
{
    const handler = types.CjsGraphTypeUint8ClampedArray;
    const input = [-1, 0.5, 1.5, 2.5, 3.5, 254.5, 255.5, Infinity, NaN];
    const output = [0, 0, 2, 2, 4, 254, 255, 255, 0];
    assert.deepEqual(input.map(value => handler.convert(value)), output);
    assert.equal(handler.isLike(input, new Uint8ClampedArray(output)), true);
    assert.equal(types.CjsGraphTypeUint8Array.convert(-1), 255);
});

test("array conversion rejects incompatible primitives consistently for same-size writes and resize", () =>
{
    for (const ctor of [...numericArrays, ...bigArrays])
    {
        const handler = types[`CjsGraphType${ctor.name}`];
        const invalid = bigArrays.includes(ctor) ? 1 : 1n;
        assert.throws(() => handler.set({ value: new ctor(1) }, "value", [invalid]), TypeError);
        assert.throws(() => handler.set({ value: new ctor(0) }, "value", [invalid]), TypeError);
        assert.throws(() => handler.convert(invalid), TypeError);
    }
});

test("native array equality gaps do not affect exact comparisons or unchanged writes", () =>
{
    for (const ctor of [Int32Array, Float64Array])
    {
        const handler = types[`CjsGraphType${ctor.name}`];
        for (const values of [[], [1, 2]])
        {
            const a = new ctor(values), b = new ctor(values);
            assert.equal(handler.isEqual(a, b), false, "Carbon default AreEqual has no specialization");
            assert.equal(handler.isLike(values, b), false);
            assert.equal(handler.isExactEqual(a, b), true);
            assert.equal(handler.set({ value: a }, "value", b), false);
        }
    }
    for (const ctor of [Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Uint32Array, ...bigArrays])
    {
        const handler = types[`CjsGraphType${ctor.name}`];
        const values = bigArrays.includes(ctor) ? [1n, 2n] : [1, 2];
        assert.equal(handler.isEqual(new ctor(values), new ctor(values)), true);
        assert.equal(handler.isLike(values, new ctor(values)), true);
        assert.equal(handler.isEqual(values, new ctor(values)), false);
    }
});

test("Float64 arrays retain precision while Float32 array equality keeps Carbon's NaN quirk", () =>
{
    const value = 1 + 2 ** -40;
    const target = { value: new Float64Array([0, 0]) };
    assert.equal(types.CjsGraphTypeFloat64Array.set(target, "value", [value, -0]), true);
    assert.equal(target.value[0], value);
    assert.equal(Object.is(target.value[1], -0), true);
    assert.equal(types.CjsGraphTypeFloat64Array.set(target, "value", [value, -0]), false);
    assert.equal(types.CjsGraphTypeFloat64Array.set(target, "value", [value, 0]), true);
    assert.equal(types.CjsGraphTypeFloat32Array.convert(value), 1);
    assert.equal(types.CjsGraphTypeFloat32Array.isEqual(new Float32Array([Infinity]), new Float32Array([Infinity])), true);
    assert.equal(types.CjsGraphTypeFloat32.isEqual(Infinity, Infinity), false);
});
