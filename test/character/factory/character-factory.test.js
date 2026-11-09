// The character factory's DNA core: reading and writing a DNA, the sex defaults, and their merge.
import test from "node:test";
import assert from "node:assert/strict";
import { CjsCharacterFactory } from "../../../npm/dist/character/index.js";

test("the defaults are the clean character: eyebrows, head, body, eyes and underwear on, the underwear not overridable", () =>
{
  for (const sex of [ "female", "male" ])
  {
    const defaults = CjsCharacterFactory.GetDefaults(sex);
    assert.equal(defaults.sex, sex);
    assert.deepEqual(Object.keys(defaults.parts).sort(), [ "archetype", "bottomUnderwear", "eyebrows", "eyes", "skin", ...(sex === "female" ? [ "topUnderwear" ] : []) ].sort());
    assert.equal(defaults.parts.bottomUnderwear.overridable, false);
    assert.equal(defaults.parts.eyes.overridable, true);
  }
  const copy = CjsCharacterFactory.GetDefaults("female");
  copy.parts.eyes.option = "changed";
  assert.equal(CjsCharacterFactory.GetDefaults("female").parts.eyes.option, "eyes_01", "a copy the caller may change");
  assert.throws(() => CjsCharacterFactory.GetDefaults("other"), /Unknown character sex/);
});

test("a DNA reads from JSON text or a value, and writes back to the same DNA", () =>
{
  const dna = { sex: "male", parts: { lipstick: { enabled: true, option: "lipstick_02", weight: .5, colors: [ [ 1, 0, 0, 1 ], [ 0, 1, 0, 1 ], [ 0, 0, 1, 1 ] ] } } };
  const read = CjsCharacterFactory.ReadJSON(JSON.stringify(dna));
  assert.deepEqual(read, dna);
  assert.notEqual(read.parts.lipstick.colors, dna.parts.lipstick.colors, "a copy");
  assert.deepEqual(CjsCharacterFactory.ReadJSON(CjsCharacterFactory.WriteJSON(read)), read);
});

test("a DNA naming an unknown sex, part, field or value type is refused", () =>
{
  assert.throws(() => CjsCharacterFactory.ReadJSON({ sex: "x", parts: {} }), /Unknown character sex/);
  assert.throws(() => CjsCharacterFactory.ReadJSON({ sex: "male", parts: { wings: {} } }), /Unknown character part wings/);
  assert.throws(() => CjsCharacterFactory.ReadJSON({ sex: "male", parts: { eyes: { size: 2 } } }), /Unknown field size/);
  assert.throws(() => CjsCharacterFactory.ReadJSON({ sex: "male", parts: { eyes: { enabled: "yes" } } }), /enabled is not a boolean/);
  assert.throws(() => CjsCharacterFactory.ReadJSON({ sex: "male", parts: { eyes: { weight: NaN } } }), /weight is not a number/);
  assert.throws(() => CjsCharacterFactory.ReadJSON({ sex: "male", parts: { eyes: { colors: [ [ 1, 1, 1 ] ] } } }), /three RGBA/);
  assert.throws(() => CjsCharacterFactory.ReadJSON({ sex: "male", parts: {}, extra: 1 }), /Unknown character DNA field extra/);
});

test("the merge lays the DNA over the defaults, switches every other part off and keeps parts that are not overridable", () =>
{
  const merged = CjsCharacterFactory.Merge({ sex: "female", parts: {
    eyes: { option: "eyes_04" },
    lipstick: { enabled: true, option: "lipstick_02" },
    bottomUnderwear: { option: "other" }
  } });
  assert.deepEqual(Object.keys(merged.parts), CjsCharacterFactory.parts, "every part, in the factory's order");
  assert.equal(merged.parts.eyes.option, "eyes_04");
  assert.equal(merged.parts.eyes.enabled, true, "the default's other values stay");
  assert.deepEqual(merged.parts.lipstick, { enabled: true, option: "lipstick_02" }, "a part only the DNA names takes the DNA's values");
  assert.equal(merged.parts.bottomUnderwear.option, "bikinibottomcf01", "underwear is not overridable");
  assert.deepEqual(merged.problems, [ "bottomUnderwear is not overridable; the DNA's values are not applied" ]);
  assert.deepEqual(merged.parts.blush, { enabled: false }, "a part neither names is off");
  assert.equal(merged.parts.topUnderwear.enabled, true);
});
