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
            assert.equal(instance.IsValidValue(expected), true);
            assert.equal(instance.IsEqual(expected, expected), true);
            assert.equal(instance.IsEqual(input, expected), true);
            assert.equal(instance.Get(target, "value"), expected);
            assert.equal(instance.Clone(target, "value"), expected);
        }
        assert.equal(instance.IsValidValue(0.5), false);
        assert.equal(instance.IsValidValue("1"), false);
        assert.equal(instance.IsValidValue(NaN), false);
        assert.equal(instance.IsValidValue(Infinity), false);
        assert.equal(instance.IsEqual("1", 1), true);
    }
    assert.equal(types.CjsGraphTypeInt8.isValidValue(128), false);
    assert.equal(types.CjsGraphTypeUint8.isValidValue(-1), false);
    assert.equal(types.CjsGraphTypeInt16.isValidValue(32768), false);
    assert.equal(types.CjsGraphTypeUint16.isValidValue(65536), false);
    assert.equal(types.CjsGraphTypeInt32.isValidValue(2 ** 31), false);
    assert.equal(types.CjsGraphTypeUint32.isValidValue(2 ** 32), false);
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
            assert.equal(instance.IsValidValue(expected), true);
            assert.equal(instance.IsEqual(input, expected), true);
        }
        assert.equal(handler.isValidValue(1), true, "a safe integer is valid, as the Black reader stores it");
        assert.equal(handler.isValidValue(1.5), false);
        assert.equal(handler.isValidValue(2 ** 53), false);
        assert.equal(handler.convert(1), 1, "stored as given");
        assert.equal(handler.isEqual(1, 1n), true);
        assert.equal(handler.isValidValue(-1), handler.signed);
        assert.equal(handler.isValidValue(2n ** 64n), false);
        assert.equal(handler.isValidValue("1"), true, "JSON writes 64-bit values as strings");
        assert.equal(handler.isValidValue("1.5"), false);
        assert.equal(handler.isValidValue("0x10"), false);
        assert.equal(handler.isValidValue(""), false);
        assert.equal(handler.isValidValue(String(2n ** 64n)), false);
        assert.equal(handler.isValidValue([ 1, 2 ]), true, "a [high, low] pair is valid input");
        assert.equal(handler.isValidValue([ 1 ]), false);
        assert.equal(handler.isValidValue([ 1, 2, 3 ]), false);
        assert.equal(handler.isValidValue([ 1.5, 0 ]), false);
        assert.equal(handler.isValidValue([ 2 ** 32, 0 ]), false);
        assert.equal(handler.isValidValue([ -(2 ** 31) - 1, 0 ]), false);
        assert.equal(handler.isValidValue([ "1", 2 ]), false);
        assert.equal(handler.isEqual("1", 1n), true, "any accepted form, on either side");
        assert.equal(handler.isEqual(1n, 1n), true);
        assert.equal(handler.isEqual([ 0, 1 ], "1"), true);
        assert.equal(handler.isEqual(1n, 2n), false);
        assert.throws(() => handler.convert(1.5), TypeError);
        assert.throws(() => handler.convert("1.5"), SyntaxError);
    }
    const source = { value: 9007199254740993n }, target = { value: 0n };
    assert.equal(types.CjsGraphTypeInt64.copy(source, "value", target, "value"), true);
    assert.equal(target.value, 9007199254740993n);
    assert.equal(types.CjsGraphTypeUint64.isValidValue(-1n), false);
    assert.equal(types.CjsGraphTypeInt64.isValidValue(2n ** 63n), false);
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
    assert.equal(types.CjsGraphTypeInt64.isEqual([ 1, 2 ], (1n << 32n) + 2n), true);
    assert.equal(types.CjsGraphTypeInt64.isExactEqual([ 1, 2 ], (1n << 32n) + 2n), true);
});

test("every array handler takes a plain array through IsValidValue and Set, keeping its storage", () =>
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

        assert.equal(handler.isValidValue(plain), true, name);
        assert.equal(handler.set(target, "value", plain), true, name);
        assert.equal(target.value, storage, name);
        assert.deepEqual(Array.from(storage), plain, name);
        assert.equal(handler.set(target, "value", plain), false, name);
        assert.deepEqual(handler.get(target, "value"), plain, name);
        assert.equal(handler.isEqual(plain, storage), true, name);
        assert.equal(handler.isExactEqual(storage, plain), true, name);
        assert.equal(handler.isValidValue(plain.slice(1)), handler.elementCount === 0, name);
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

        assert.equal(handler.isValidValue(plain), true);
        assert.equal(handler.set(target, "value", plain), true);
        assert.equal(target.value, storage);
        assert.deepEqual(Array.from(storage), expected);
        assert.equal(handler.set(target, "value", plain), false);

        // A variable length change allocates replacement storage through the same path.
        assert.equal(handler.set(target, "value", [ [ 0, 9 ] ]), true);
        assert.notEqual(target.value, storage);
        assert.deepEqual(Array.from(target.value), [ 9n ]);
        assert.equal(handler.isValidValue([ 1, 2 ]), false, "number elements are not 64-bit input, and a pair is not a whole array");
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
        // The inputs hold NaN: Set always overwrites one, and Float64 elements also never call Infinity equal.
        assert.equal(instance.Set(target, "value", inputs), ctor === Float32Array || ctor === Float64Array, "change detection uses destination conversion");
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

        assert.equal(instance.IsValidValue(storage), true);
        assert.equal(instance.IsValidValue(Array.from(storage)), true, "a plain array is valid input");
        assert.equal(instance.IsValidValue([ "not a number" ]), false);
        assert.equal(instance.IsValidValue([ undefined ]), false);
        assert.equal(instance.IsValidValue(new DataView(new ArrayBuffer(8))), false);
        assert.equal(instance.IsValidValue(runInNewContext(`new ${ctor.name}(2)`)), true);
        assert.equal(instance.IsValidValue(new (bigArrays.includes(ctor) ? Float32Array : BigInt64Array)(2)), false);
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
    assert.equal(handler.isEqual(input, new Uint8ClampedArray(output)), true);
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

test("every array family compares values in any accepted form", () =>
{
    for (const ctor of [Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array,
        Float32Array, Float64Array, ...bigArrays])
    {
        const handler = types[`CjsGraphType${ctor.name}`];
        const big = bigArrays.includes(ctor);
        for (const values of [[], big ? [1n, 2n] : [1, 2]])
        {
            const a = new ctor(values), b = new ctor(values);
            assert.equal(handler.isEqual(a, b), true, ctor.name);
            assert.equal(handler.isEqual(values, b), true, ctor.name);
            assert.equal(handler.isEqual(b, values), true, ctor.name);
            assert.equal(handler.isExactEqual(values, b), true, ctor.name);
            assert.equal(handler.set({ value: a }, "value", b), false, ctor.name);
        }
        assert.equal(handler.isEqual(new ctor(big ? [1n] : [1]), new ctor(big ? [2n] : [2])), false, ctor.name);
    }
});

test("Set overwrites a stored NaN, while IsEqual keeps Carbon's quirk (CE-202)", () =>
{
    const handler = types.CjsGraphTypeFloat32Array;
    const stored = { value: new Float32Array([NaN, 1]) };
    assert.equal(handler.isEqual(stored.value, [3, 1]), true, "Carbon's comparison is unchanged");
    assert.equal(handler.set(stored, "value", [3, 1]), true);
    assert.equal(stored.value[0], 3);
    assert.equal(handler.set(stored, "value", [3, 1]), false);

    const vector = { value: new Float32Array([NaN, NaN, NaN]) };
    assert.equal(types.CjsGraphTypeVector3.set(vector, "value", [1, 2, 3]), true, "every Float32 family");
    assert.equal(vector.value[0], 1);

    const scalar = { value: NaN };
    assert.equal(types.CjsGraphTypeFloat32.set(scalar, "value", 3), true);
    assert.equal(scalar.value, 3);

    assert.equal(handler.isValidValue([NaN]), true, "NaN stays valid input");
    assert.equal(types.CjsGraphTypeFloat32.isValidValue(NaN), true);
});

test("an array member holding null gets owned storage", () =>
{
    const target = { value: null };
    assert.equal(types.CjsGraphTypeVector3.set(target, "value", [1, 2, 3]), true);
    assert.equal(target.value.constructor, Float32Array);
    assert.deepEqual(Array.from(target.value), [1, 2, 3]);
});

test("Float64 arrays retain precision while Float32 array equality keeps Carbon's NaN quirk", () =>
{
    const value = 1 + 2 ** -40;
    const target = { value: new Float64Array([0, 0]) };
    assert.equal(types.CjsGraphTypeFloat64Array.set(target, "value", [value, -0]), true);
    assert.equal(target.value[0], value);
    assert.equal(Object.is(target.value[1], -0), true);
    assert.equal(types.CjsGraphTypeFloat64Array.set(target, "value", [value, -0]), false);
    assert.equal(types.CjsGraphTypeFloat64Array.set(target, "value", [value, 0]), false, "equal within tolerance");
    assert.equal(types.CjsGraphTypeFloat64Array.isExactEqual(target.value, [value, 0]), true, "-0 and 0 are the same value");
    assert.equal(types.CjsGraphTypeFloat32Array.convert(value), 1);
    assert.equal(types.CjsGraphTypeFloat32Array.isEqual(new Float32Array([Infinity]), new Float32Array([Infinity])), true);
    assert.equal(types.CjsGraphTypeFloat32.isEqual(Infinity, Infinity), false);
});
