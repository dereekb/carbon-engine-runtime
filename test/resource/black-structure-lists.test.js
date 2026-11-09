// Production structure lists read by BlackReader (BlackReader.cpp ReadStructureList): each record at its file stride,
// in the item class's layout. A record shorter than the class's size is read up to a member boundary and leaves the
// rest at the class default; any other stride fails with Carbon's "Structure is not compatible with data in file".
// Byte layouts as Carbon writes them (BlackWriter.cpp:299-304), ported from the retired reader's tests.
import test from "node:test";
import assert from "node:assert/strict";
import "../../npm/dist/trinity/index.js";
import "../../npm/dist/sof/index.js";
import { BlackReader } from "../../npm/dist/blue/formats/black/BlackReader.js";
import { CjsSchema } from "../../npm/dist/blue/schema/CjsSchema.js";
import { Tr2Effect } from "../../npm/dist/trinity/shader/Tr2Effect.js";
import { Tr2SamplerOverride } from "../../npm/dist/trinity/shader/sampler/Tr2SamplerOverride.js";
import { Fixture, concat, i32, u16, u32 } from "../support/blackFixture.js";
import { blackBuilder, readBlack } from "../support/blackReader.js";

/** A struct record's own fields as plain data, vectors as plain arrays. */
const plainRecord = record => Object.fromEntries(Object.entries(record).map(([ key, value ]) => [ key, ArrayBuffer.isView(value) ? Array.from(value) : value ]));

/** A structure list member: count, record stride, records. */
const structureList = (stride, records) => concat([ u32(records.length), u16(stride), ...records ]);

/** A read that must fail: BlackReader returns null and says why. */
function readFails(bytes, pattern)
{
  const reader = new BlackReader();
  reader.SetDoInitialize(false);
  assert.equal(reader.ReadFromStream(bytes), null);
  assert.match(reader.GetErrorMessage(), pattern);
}

// Tr2SamplerOverrideStructureDef (Tr2Effect.cpp:84-95): sizeof 56, including the unexposed shared_ptr at 40..55.
function samplerBytes(stride = 56)
{
  const f = new Fixture();
  const records = [ "PatternSampler", "OtherSampler" ].map((name, index) =>
  {
    const bytes = new Uint8Array(56), view = new DataView(bytes.buffer);
    bytes.set(f.S(name));
    bytes.fill(0xa5, 2, 8);
    for (const [ offset, value ] of [ [ 8, index ? 0xffffffff : 1 ], [ 12, 2 ], [ 16, 3 ], [ 20, 2 ], [ 24, 2 ], [ 32, index + 4 ], [ 36, index + 8 ] ]) view.setUint32(offset, value, true);
    view.setFloat32(28, index + .25, true);
    bytes.fill(0xab, 40, 56);
    return bytes.slice(0, stride);
  });
  return f.Finish(f.Object(1, "Tr2Effect", [ [ "samplerOverrides", structureList(stride, records) ], [ "effectFilePath", f.S("res:/authored/samplers.fx") ] ]));
}

test("sampler overrides read unsigned fields and advance by the full native stride", context =>
{
  context.mock.method(Tr2Effect.prototype, "Initialize", () => assert.fail("not initialized"));
  const effect = readBlack(samplerBytes(), { initialize: false });
  assert.equal(effect.constructor, Tr2Effect);
  assert.equal(effect.samplerOverrides.length, 2);
  assert.equal(effect.samplerOverrides[0].constructor, Tr2SamplerOverride);
  assert.deepEqual(plainRecord(effect.samplerOverrides[0]), { name: "PatternSampler", addressU: 1, addressV: 2,
    addressW: 3, filter: 2, mipFilter: 2, lodBias: .25, maxMipLevel: 4, maxAnisotropy: 8 });
  assert.equal(effect.samplerOverrides[1].addressU, 0xffffffff);
  assert.equal(effect.samplerOverrides[1].lodBias, 1.25);
  assert.ok(effect.samplerOverrides.every(row => !Object.hasOwn(row, "sampler")), "native pointers are never read");
  assert.equal(effect.effectFilePath, "res:/authored/samplers.fx", "the next member follows the full stride");
  readFails(samplerBytes(39), /samplerOverrides: Structure is not compatible with data in file/);
});

// Tr2ShaderOptionStructureDef (Tr2Effect.cpp:110-114): two 8-byte shared-string slots.
function optionBytes(stride = 16)
{
  const f = new Fixture();
  const records = [ [ "QUALITY", "HIGH" ], [ "MODE", "" ] ].map(([ name, value ]) =>
    concat([ f.S(name), new Uint8Array(6).fill(0xa5), f.S(value), new Uint8Array(6).fill(0x5a) ]).slice(0, stride));
  return f.Finish(f.Object(1, "Tr2Effect", [ [ "options", structureList(stride, records) ], [ "effectFilePath", f.S("res:/authored/options.fx") ] ]));
}

test("shader options read their string slots and ignore the padding", () =>
{
  const effect = readBlack(optionBytes(), { initialize: false });
  assert.ok(effect.options.every(option => CjsSchema.getClassName(option.constructor) === "Tr2ShaderOption"));
  assert.deepEqual(effect.options.map(option => ({ ...option })), [ { name: "QUALITY", value: "HIGH" }, { name: "MODE", value: "" } ]);
  assert.equal(effect.effectFilePath, "res:/authored/options.fx");
  readFails(optionBytes(7), /options: Structure is not compatible/);
});

// Tr2EffectParameterStructureDef (Tr2Effect.cpp:33-37): a uint16 string index, padding, a vec4 at 8.
function constantBytes(stride = 24, stringIndex = 0)
{
  const f = new Fixture();
  f.S("DirtColor1");
  const record = new Uint8Array(24), view = new DataView(record.buffer);
  view.setUint16(0, stringIndex, true);
  view.setUint32(2, 0xffffffff, true);
  for (let i = 0; i < 4; i++) view.setFloat32(8 + i * 4, i / 4, true);
  return f.Finish(f.Object(1, "Tr2Effect", [ [ "constParameters", structureList(stride, [ record.slice(0, stride) ]) ] ]));
}

test("constant parameters read a shared-string name and a padded vec4; a short record keeps the default value", () =>
{
  const effect = readBlack(constantBytes(), { initialize: false });
  assert.equal(effect.constParameters[0].name, "DirtColor1");
  assert.deepEqual(Array.from(effect.constParameters[0].value), [ 0, .25, .5, .75 ]);
  // The name's 8-byte slot is a boundary, the padding inside it is not.
  const short = readBlack(constantBytes(8), { initialize: false });
  const Item = short.constParameters[0].constructor;
  assert.equal(short.constParameters[0].name, "DirtColor1");
  assert.deepEqual(Array.from(short.constParameters[0].value), Array.from(new Item().value));
  for (const stride of [ 2, 4, 7, 9, 16, 25 ]) readFails(constantBytes(stride), /constParameters: Structure is not compatible/);
  // An index past the string table.
  readFails(constantBytes(24, 999), /Invalid string index/);
});

const scalarKeys = [
  { time: 0, value: 2, leftTangent: .5, rightTangent: 3, id: 0xbeef, interpolation: 1, tangentType: 3 },
  { time: 4, value: 10, leftTangent: 4, rightTangent: -.5, id: 0xfedc, interpolation: 2, tangentType: 2 }
];

// Tr2CurveScalarKeyDef (Tr2CurveScalar.cpp:11-20): four floats, a uint16 id, two uint8s; sizeof 20.
function scalarCurveBytes(stride = 20)
{
  const f = new Fixture();
  const records = scalarKeys.map(key =>
  {
    const bytes = new Uint8Array(20), view = new DataView(bytes.buffer);
    [ key.time, key.value, key.leftTangent, key.rightTangent ].forEach((value, index) => view.setFloat32(index * 4, value, true));
    view.setUint16(16, key.id, true);
    view.setUint8(18, key.interpolation);
    view.setUint8(19, key.tangentType);
    return bytes.slice(0, stride);
  });
  return f.Finish(f.Object(1, "Tr2CurveScalar", [ [ "keys", structureList(stride, records) ], [ "name", f.S("AuthoredScalar") ] ]));
}

test("scalar curve keys read mixed-width members without settling the curve", context =>
{
  const curveClass = CjsSchema.getConstructor("Tr2CurveScalar");
  const changed = context.mock.method(curveClass.prototype, "OnKeysChanged", () => assert.fail("reading does not settle keys"));
  const curve = readBlack(scalarCurveBytes(), { initialize: false });
  assert.deepEqual(curve.keys.map(plainRecord), scalarKeys);
  assert.equal(curve.name, "AuthoredScalar");
  assert.equal(changed.mock.callCount(), 0);
  changed.mock.restore();
  assert.equal(curve.GetValue(2), 6);
});

test("scalar keys read up to a member boundary, the rest at the key's defaults; other sizes fail", () =>
{
  const fields = [ "time", "value", "leftTangent", "rightTangent", "id", "interpolation", "tangentType" ];
  const boundaries = [ 4, 8, 12, 16, 18, 19, 20 ];
  for (const stride of boundaries.slice(0, -1))
  {
    const curve = readBlack(scalarCurveBytes(stride), { initialize: false });
    const defaults = plainRecord(new curve.keys[0].constructor());
    for (let index = 0; index < 2; index++)
    {
      assert.deepEqual(plainRecord(curve.keys[index]), Object.fromEntries(fields.map((name, member) =>
        [ name, boundaries[member] <= stride ? scalarKeys[index][name] : defaults[name] ])), `stride ${stride}, record ${index}`);
    }
    assert.equal(curve.name, "AuthoredScalar");
  }
  for (const stride of [ 0, 1, 3, 5, 17, 21 ]) readFails(scalarCurveBytes(stride), /keys: Structure is not compatible/);
});

const quaternionKeys = [
  { time: 0, value: [ 0, 0, 0, 1 ], id: 0xbeef, interpolation: 1 },
  { time: 4, value: [ 0, 0, 1, 0 ], id: 0xfedc, interpolation: 0xabcd }
];

// Tr2CurveQuaternionKeyDef (Tr2CurveQuaternion.cpp:11-17): a float, four quaternion floats, two uint16s; sizeof 24.
function quaternionCurveBytes(stride = 24)
{
  const f = new Fixture();
  const records = quaternionKeys.map(key =>
  {
    const bytes = new Uint8Array(24), view = new DataView(bytes.buffer);
    view.setFloat32(0, key.time, true);
    key.value.forEach((value, index) => view.setFloat32(4 + index * 4, value, true));
    view.setUint16(20, key.id, true);
    view.setUint16(22, key.interpolation, true);
    return bytes.slice(0, stride);
  });
  return f.Finish(f.Object(1, "Tr2CurveQuaternion", [ [ "keys", structureList(stride, records) ], [ "name", f.S("AuthoredQuaternion") ] ]));
}

test("quaternion keys read whole, or short at a boundary with a fresh default value per record", () =>
{
  const curve = readBlack(quaternionCurveBytes(), { initialize: false });
  assert.deepEqual(curve.keys.map(plainRecord), quaternionKeys);
  assert.notEqual(curve.keys[0].value, curve.keys[1].value);
  for (const stride of [ 4, 20, 22 ])
  {
    const short = readBlack(quaternionCurveBytes(stride), { initialize: false });
    const defaults = plainRecord(new short.keys[0].constructor());
    assert.deepEqual(short.keys.map(plainRecord), quaternionKeys.map(key => ({ time: key.time,
      value: stride >= 20 ? key.value : defaults.value, id: stride >= 22 ? key.id : defaults.id, interpolation: defaults.interpolation })));
    assert.notEqual(short.keys[0].value, short.keys[1].value);
  }
  for (const stride of [ 0, 3, 8, 19, 21, 23, 25 ]) readFails(quaternionCurveBytes(stride), /keys: Structure is not compatible/);
});

test("a 44-byte locator, the list before trinity a9a60056, reads its members and keeps partTag's default", () =>
{
  const locatorBytes = size =>
  {
    const f = new Fixture();
    const record = new Uint8Array(size);
    if (size >= 44) new DataView(record.buffer).setInt32(40, 7, true);
    return f.Finish(f.Object(1, "EveLocatorSets", [ [ "locators", structureList(size, [ record ]) ] ]));
  };
  const sets = readBlack(locatorBytes(44), { initialize: false });
  const [ locator ] = sets.locators;
  assert.equal(locator.boneIndex, 7);
  assert.equal(locator.partTag, new locator.constructor().partTag);
  readFails(locatorBytes(42), /locators: Structure is not compatible/);
});

test("a builder reads the same file again into a new graph", () =>
{
  const builder = blackBuilder(samplerBytes(), { initialize: false });
  const first = builder.CreateObject(0), second = builder.CreateObject(0);
  assert.notEqual(first, second);
  assert.notEqual(first.samplerOverrides, second.samplerOverrides);
  assert.deepEqual(second.samplerOverrides.map(plainRecord), first.samplerOverrides.map(plainRecord));
});
