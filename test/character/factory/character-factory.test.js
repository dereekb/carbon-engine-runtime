// The character factory's DNA core: reading and writing a DNA, the sex defaults, and their merge.
import test from "node:test";
import assert from "node:assert/strict";
import { CjsCharacterFactory, CjsPaperDollDefinition, CjsPaperDollInstance } from "../../../npm/dist/character/index.js";
import { installBlueServices } from "../../../npm/dist/blue/blue.js";

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

/** A definition with a few parts configured, and a library whose palettes are coloured by their path's length. */
function configuredDefinition(t)
{
  const characterLibrary = { FetchPalette: async path => ({ colors: [ 0, 1, 2 ].map(i => Float32Array.of(path.length % 7 / 10, i / 10, 0, 1)), specularColors: null, pattern: null }) };
  const previous = installBlueServices({ characterLibrary }, false);
  t.after(() => installBlueServices(previous, previous.running));
  const definition = new CjsPaperDollDefinition();
  definition.sex = "female";
  const resolved = [];
  const resolve = id => { resolved.push(id); return Promise.resolve({ colorAreas: [ 1, 2, 3 ] }); };
  definition.bottomUnderwear.Configure([ { id: "bikinibottomcf01", path: "bottomunderwear/bikinibottomcf01", palettes: [] } ], new Map(), { resolve });
  definition.eyebrows.Configure([ { id: "eyebrows_01" } ], new Map(), { resolve });
  definition.lipstick.Configure([ { id: "lipstick_01" }, { id: "lipstick_02" } ], new Map(), { option: "lipstick_01", resolve });
  definition.blush.Configure([ { id: "blush_01" } ], new Map(), { option: "blush_01", resolve });
  return { definition, resolved };
}

test("Build writes the merged DNA onto a definition: options resolved when on, palettes read, every other part off", async t =>
{
  const { definition, resolved } = configuredDefinition(t);
  const { problems } = await CjsCharacterFactory.Build(definition, { sex: "female", parts: {
    lipstick: { enabled: true, option: "lipstick_02", colors: [ [ 1, 0, 0, 1 ], [ 0, 1, 0, 1 ], [ 0, 0, 1, 1 ] ] }
  } });
  assert.deepEqual([ definition.bottomUnderwear.enabled, definition.bottomUnderwear.option, definition.bottomUnderwear.overridable ], [ true, "bikinibottomcf01", false ]);
  assert.equal(definition.bottomUnderwear.palette, "res:/graphics/character/female/paperdoll/bottomunderwear/bikinibottomcf01/default.color");
  assert.equal(Number(definition.bottomUnderwear.color2[1].toFixed(2)), .1, "the palette file's colours");
  assert.deepEqual([ definition.lipstick.enabled, definition.lipstick.option, definition.lipstick.customColors, Array.from(definition.lipstick.color1) ], [ true, "lipstick_02", true, [ 1, 0, 0, 1 ] ]);
  assert.deepEqual([ definition.blush.enabled, definition.blush.option, definition.blush.weight ], [ false, "", 0 ], "a part neither names is off, with no option");
  assert.deepEqual(resolved.sort(), [ "bikinibottomcf01", "eyebrows_01", "lipstick_02" ], "only the parts that are on are resolved");
  assert.ok(problems.some(problem => /^archetype: option archetypes\/cdshape is not listed/.test(problem)), "what cannot apply is reported");
  assert.ok(problems.some(problem => /^eyes: option eyes_01 is not listed/.test(problem)));
});

test("ResetPart and Reset put a part, or the whole character, back to the defaults", async t =>
{
  const { definition } = configuredDefinition(t);
  await CjsCharacterFactory.Build(definition, { sex: "female", parts: { lipstick: { enabled: true, option: "lipstick_02" }, eyebrows: { enabled: false } } });
  await CjsCharacterFactory.ResetPart(definition, "eyebrows");
  assert.deepEqual([ definition.eyebrows.enabled, definition.eyebrows.option ], [ true, "eyebrows_01" ]);
  assert.equal(definition.lipstick.enabled, true, "only that part");
  definition.SetLayer("lipstick", 1);
  await CjsCharacterFactory.Reset(definition);
  assert.deepEqual([ definition.lipstick.enabled, definition.lipstick.option, definition.lipstick.customColors ], [ false, "", false ]);
  assert.equal(definition.GetLayer("lipstick"), definition.lipstick.constructor.layer, "the layer order back to the class ranks");
  await assert.rejects(CjsCharacterFactory.ResetPart(definition, "wings"), /Unknown character part wings/);
});

test("the paper doll holds a part that is not overridable on, unless a worn part occludes it", async t =>
{
  const { definition } = configuredDefinition(t);
  await CjsCharacterFactory.Build(definition, { sex: "female", parts: {} });
  definition.bottomUnderwear.enabled = false;
  CjsPaperDollInstance.holdParts(definition);
  assert.equal(definition.bottomUnderwear.enabled, true, "switched back on: nothing occludes it");
  // A worn part whose option occludes the underwear's category lets it be switched off.
  definition.lipstick.Configure([ { id: "cover", occludes: [ "bottomunderwear" ] } ], new Map(), { option: "cover" });
  definition.lipstick.enabled = true;
  definition.bottomUnderwear.enabled = false;
  CjsPaperDollInstance.holdParts(definition);
  assert.equal(definition.bottomUnderwear.enabled, false, "an occluder removes it");
  definition.bottomUnderwear.overridable = true;
  definition.lipstick.enabled = false;
  CjsPaperDollInstance.holdParts(definition);
  assert.equal(definition.bottomUnderwear.enabled, false, "an overridable part stays as the user set it");
});
