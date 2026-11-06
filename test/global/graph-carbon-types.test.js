import assert from "node:assert/strict";
import { test } from "node:test";
import { VARTYPE } from "../../src/global/model/graph/GraphTypes.js";
import * as types from "../../src/global/model/graph/types/index.js";

// Coverage oracle, not a runtime registry or a new Blue dispatch path.
const nativeTypes = [
    ["INVALID", "Invalid", "throwing"],
    ["LONG", "Int32", "implemented"],
    ["FLOAT", "Float32", "implemented"],
    ["DOUBLE", "Float64", "implemented"],
    ["BOOL", "Boolean", "implemented"],
    ["IROOT", "IRoot", "object"],
    ["IROOTPTR", "IRootPtr", "object"],
    ["CHARARRAY", "CharArray", "pending"],
    ["CSTRING", "CString", "implemented"],
    ["INT64", "Int64", "implemented"],
    ["PYOBJECT", "PyObject", "unsupported"],
    ["PYOBJECTPTR", "PyObjectPtr", "unsupported"],
    ["REFERENCE", "Reference", "implemented"],
    ["WCSTRING", "WCString", "implemented"],
    ["WREFERENCE", "WReference", "implemented"],
    ["FLOATARRAY", "Float32Array", "implemented"],
    ["DOUBLEARRAY", "Float64Array", "implemented"],
    ["INTARRAY", "Int32Array", "implemented"],
    ["ROTREFERENCE", "RotReference", "unsupported"],
    ["IROOTWEAKREF", "IRootWeakRef", "object"],
    ["_PYPROPERTY", "PyProperty", "unsupported"],
    ["STDSTRING", "String", "implemented"],
    ["STDWSTRING", "WString", "implemented"],
    ["BINARYBLOCK", "BinaryBlock", "pending"],
    ["BYTE", "Uint8", "implemented"],
    ["SHORT", "Uint16", "implemented"],
    ["SCRIPTCALLBACK", "ScriptCallback", "pending"],
    ["SHAREDSTRING", "SharedString", "implemented"],
    ["SHAREDSTRINGW", "SharedStringW", "implemented"],
    ["ULONG", "Uint32", "implemented"],
    ["UINT64", "Uint64", "implemented"]
];

test("every distinct Carbon VARTYPE has its own definition, without collapsing shared JS storage", () =>
{
    const nativeNames = Object.keys(VARTYPE).filter(name => name !== "VARTYPE_MAX" && name !== "VARTYPE_FORCELONG");
    assert.deepEqual(nativeTypes.map(([name]) => name).sort(), nativeNames.sort());
    assert.equal(nativeTypes.length, 31);
    const handlers = new Set(), names = new Set(), codes = new Set();

    for (const [nativeName, name, state] of nativeTypes)
    {
        const handler = types[`CjsGraphType${name}`];
        assert.equal(typeof handler, "function", nativeName);
        const instance = new handler();
        handlers.add(handler);
        names.add(instance.name);
        codes.add(VARTYPE[nativeName]);
        assert.equal(instance.name, name);
        assert.equal(handler.className, `CjsGraphType${name}`);
        for (const operation of ["get", "set", "copy", "clone", "isEqual"])
        {
            if (state === "object" && (operation === "get" || operation === "set")) assert.equal(typeof handler[operation], "function", nativeName);
            else if (state === "implemented" || state === "throwing") assert.equal(typeof handler[operation], "function", `${nativeName}.${operation}`);
            else assert.equal(operation in handler, false, `${nativeName} must not inherit a misleading scalar ${operation}`);
        }
    }
    assert.equal(handlers.size, 31);
    assert.equal(names.size, 31);
    assert.equal(codes.size, 31);
    assert.equal(VARTYPE.VARTYPE_MAX, VARTYPE.UINT64, "MAX is an alias, not another type");
    assert.equal(codes.has(VARTYPE.VARTYPE_FORCELONG), false, "FORCELONG is an enum-width sentinel");
});

test("standard narrow/wide strings preserve distinct definitions and full Unicode/NUL contents", () =>
{
    assert.notEqual(types.CjsGraphTypeString, types.CjsGraphTypeWString);
    const text = "Tākahē 😀\0tail";
    for (const handler of [types.CjsGraphTypeString, types.CjsGraphTypeWString])
    {
        const instance = new handler(), target = { value: "" };
        assert.equal(instance.ctor, String);
        assert.equal(instance.Set(target, "value", text), true);
        assert.equal(instance.Set(target, "value", text), false);
        assert.equal(instance.Get(target, "value"), text);
        assert.equal(instance.Clone(target, "value"), text);
        assert.equal(instance.IsEqual(text, "Tākahē 😀\0other"), false);
        assert.equal(instance.Copy({ value: "résumé" }, "value", target, "value"), true);
        assert.equal(target.value, "résumé");
        assert.equal(instance.IsEqual(12, "12"), true, "compared as Set would store them");
    }
});

test("C, reference and shared string families reuse NUL-terminated operations without aliasing definitions", () =>
{
    const handlers = [types.CjsGraphTypeCString, types.CjsGraphTypeWCString,
        types.CjsGraphTypeReference, types.CjsGraphTypeWReference,
        types.CjsGraphTypeSharedString, types.CjsGraphTypeSharedStringW];
    assert.equal(new Set(handlers).size, 6);
    for (const handler of handlers)
    {
        const instance = new handler(), target = { value: "" };
        assert.equal(instance.ctor, String);
        assert.equal(instance.Set(target, "value", "é😀\0suffix"), true);
        assert.equal(target.value, "é😀");
        assert.equal(instance.Set(target, "value", "é😀\0other"), false);
        assert.equal(instance.IsEqual("é😀\0suffix", "é😀\0other"), true);
        assert.equal(instance.IsExactEqual("é😀\0suffix", "é😀\0other"), true, "only the visible prefix is the value");
        assert.equal(instance.IsEqual("é😀", "é😁"), false);
        assert.equal(instance.IsEqual(null, ""), false);
        assert.equal(instance.IsEqual(12, "12\0tail"), true);
        assert.equal(instance.Get({ value: "head\0tail" }, "value"), "head");
        assert.equal(instance.Clone({ value: "head\0tail" }, "value"), "head");
        assert.equal(instance.Copy({ value: "copy\0tail" }, "value", target, "value"), true);
        assert.equal(target.value, "copy");
        assert.equal(handler.convert("\0tail"), "");
    }
});

test("Invalid rejects every static and instance value operation without touching values", () =>
{
    const handler = types.CjsGraphTypeInvalid;
    const instance = new handler();
    let accesses = 0;
    const target = new Proxy({}, {
        get() { accesses++; throw new Error("Unexpected read"); },
        set() { accesses++; throw new Error("Unexpected write"); }
    });
    const cases = [
        ["get", "Get", [target, "missing"]],
        ["set", "Set", [target, "missing", 42]],
        ["copy", "Copy", [target, "source", target, "missing"]],
        ["clone", "Clone", [target, "missing"]],
        ["isValidValue", "IsValidValue", [target]],
        ["isUnchanged", "IsUnchanged", [target, target]],
        ["isExactEqual", "IsExactEqual", [target, target]],
        ["isEqual", "IsEqual", [target, target]]
    ];
    for (const [staticName, instanceName, args] of cases)
    {
        assert.throws(() => handler[staticName](...args), { name: "TypeError", message: /Invalid type handler/ });
        assert.throws(() => instance[instanceName](...args), { name: "TypeError", message: /Invalid type handler/ });
    }
    assert.throws(() => handler.convert(target), { name: "TypeError", message: /Invalid type handler/ });
    assert.throws(() => instance.Get(target, "missing"), /missing/);
    assert.equal(accesses, 0);
});

const mathDefinitions = [
    ["Vector2", Float32Array, 2], ["Vector2d", Float64Array, 2],
    ["Vector3", Float32Array, 3], ["Vector3d", Float64Array, 3], ["Vector3i", Int32Array, 3],
    ["Vector4", Float32Array, 4], ["Vector4d", Float64Array, 4],
    ["Matrix", Float32Array, 16], ["Color", Float32Array, 4], ["Quaternion", Float32Array, 4]
];

for (const [name, ctor, length] of mathDefinitions)
{
    test(`${name} shares array operations with fixed defaults in both static and instance calls`, () =>
    {
        const handler = types[`CjsGraphType${name}`];
        const instance = new handler();
        assert.equal(instance.name, name);
        assert.equal(instance.ctor, ctor);
        assert.equal(handler.elementCount, length, "the handler carries its size");
        const values = Array.from({ length }, (_, index) => index + 1);
        const storage = new ctor(length), target = { value: storage };
        assert.equal(handler.set(target, "value", values), true);
        assert.equal(instance.Set(target, "value", values), false);
        assert.equal(target.value, storage);
        assert.deepEqual(instance.Get(target, "value"), values, "no normalization or mathematical transform");
        assert.equal(handler.isValidValue(new ctor(length - 1)), false, "validation stays in IsValidValue");
        assert.equal(handler.isValidValue(values), true, "a plain array of the right count is valid input");
        assert.equal(handler.isValidValue([ ...values, 1 ]), false);
        const clone = handler.clone(target, "value");
        assert.equal(clone.constructor, ctor);
        assert.notEqual(clone.buffer, storage.buffer);
        assert.equal(handler.isExactEqual(clone, storage), true);
        assert.equal(handler.isValidValue(storage), true);
        assert.equal(instance.IsValidValue(new ctor(length + 1)), false);
        assert.equal(handler.isEqual(values, storage), true, "a plain array compares against stored values");
    });
}

test("named math definitions retain their own precision and native comparison policy", () =>
{
    const value = 1 + 2 ** -40;
    const single = { value: new Float32Array(2) }, double = { value: new Float64Array(2) };
    types.CjsGraphTypeVector2.set(single, "value", [value, 0]);
    types.CjsGraphTypeVector2d.set(double, "value", [value, 0]);
    assert.equal(single.value[0], 1);
    assert.equal(double.value[0], value);
    assert.equal(types.CjsGraphTypeVector2.isEqual(single.value, single.value), true);
    assert.equal(types.CjsGraphTypeVector2d.isEqual(double.value, double.value), true);
    assert.equal(types.CjsGraphTypeVector3i.isEqual(new Int32Array(3), new Int32Array(3)), true);
    assert.notEqual(types.CjsGraphTypeColor, types.CjsGraphTypeVector4);
    assert.notEqual(types.CjsGraphTypeQuaternion, types.CjsGraphTypeVector4);
});
