import test from "node:test";
import assert from "node:assert/strict";
import { CjsPaperDollColorizedSource, CjsPaperDollDefinition, PaperDollPaletteKind } from "../../../npm/dist/character/index.js";
import { Tr2Effect } from "../../../npm/dist/trinity/index.js";
import { installPartsLibrary } from "../../support/partsLibrary.js";

const ROOT = "res:/graphics/character/female/paperdoll/";
const SHADOW = ROOT + "makeup/eyeshadow/";
const FILES = [
  SHADOW + "eyeshadow_01/types/eyeshadow_01.type", SHADOW + "eyeshadow_01/colorize_head_l.png", SHADOW + "eyeshadow_01/colorize_head_z.png",
  SHADOW + "eyeshadow_01/aqua_a.color", SHADOW + "eyeshadow_01/aqua_bc.color", SHADOW + "eyeshadow_01/blue_a.color", SHADOW + "eyeshadow_01/blue_bc.color",
  SHADOW + "eyeshadow_02/types/eyeshadow_02.type", SHADOW + "eyeshadow_02/colorize_head_l.png", SHADOW + "eyeshadow_02/colorize_head_z.png",
  SHADOW + "eyeshadow_02/default.color", SHADOW + "eyeshadow_02/red.color", SHADOW + "eyeshadow_02/aa_female_head_s_4k.png"
];

function services(t)
{
  const overrides = {
    FetchPalette: async path => ({ colors: [ 0, 1, 2 ].map(() => Float32Array.of(path.length / 100, 0, 0, 1)) }),
    FetchMaterialMaskAreas__Zone: async () => [ 1, 2, 3 ]
  };
  installPartsLibrary(t, ROOT, FILES, { overrides });
}

/** A compositor recording the colourised paints it makes. */
class StubCompositor
{
  async Texture(path) { return { path, cutoutX: 0, cutoutY: 0, cutoutWidth: .5, cutoutHeight: .25, width: 512, height: 256 }; }
  async Colorized(detail, region, zone, zoneRegion, colors)
  {
    const effect = new Tr2Effect();
    effect.recorded = {};
    effect.SetParameter = (name, value) => { effect.recorded[name] = value; };
    effect.SetParameter__Vector4 = (name, value) => { effect.recorded[name] = Array.from(value); };
    Object.assign(effect, { detail, zone, initial: colors });
    return effect;
  }
}

async function configured(t)
{
  services(t);
  const build = { content: { root: ROOT, sex: "female" }, CheckActive() {}, Ready: value => value };
  const definition = new CjsPaperDollDefinition();
  const source = new CjsPaperDollColorizedSource(new StubCompositor(), build, "eyeshadow");
  await source.Configure(definition);
  return { definition, source };
}

test("each style lists its own palettes as raw records: name, kind and the areas each sets; the default is default.color only", async t =>
{
  const { definition } = await configured(t);
  const [ first, second ] = definition.eyeshadow.GetOptions();
  assert.deepEqual(first.palettes.map(record => [ record.name, record.kind, record.areas ]),
    [ [ "aqua_a", PaperDollPaletteKind.AREA_1, [ 1 ] ], [ "blue_a", PaperDollPaletteKind.AREA_1, [ 1 ] ] ]);
  assert.deepEqual(first.secondaryPalettes.map(record => [ record.name, record.kind, record.areas ]),
    [ [ "aqua_bc", PaperDollPaletteKind.AREAS_2_3, [ 2, 3 ] ], [ "blue_bc", PaperDollPaletteKind.AREAS_2_3, [ 2, 3 ] ] ]);
  assert.equal(first.defaultPalette, undefined, "no default.color: no default (the menu's first is the UI's)");
  assert.equal(first.defaultSecondaryPalette, undefined);
  assert.deepEqual(second.palettes.map(record => [ record.name, record.kind ]), [ [ "default", PaperDollPaletteKind.WHOLE ], [ "red", PaperDollPaletteKind.WHOLE ] ]);
  assert.equal(second.defaultPalette, SHADOW + "eyeshadow_02/default.color");
  assert.equal(definition.eyeshadow.enabled, false, "off until the factory sets it");
  assert.equal(definition.eyeshadow.option, "");
});

test("a style's paint draws in the captured colours at the captured weight, into the head diffuse only", async t =>
{
  const { definition, source } = await configured(t);
  assert.deepEqual(source.GetLayers({ option: "eyeshadow_02", colors: [], weight: 1 }, "head", "DiffuseMap"), [], "not yet applied");
  await definition.eyeshadow.ResolveOption("eyeshadow_02");
  assert.ok(source.IsPrepared("eyeshadow_02"));
  const colors = [ Float32Array.of(1, 0, 0, 1), Float32Array.of(0, 1, 0, 1), Float32Array.of(0, 0, 1, 1) ];
  const [ layer ] = source.GetLayers({ option: "eyeshadow_02", colors, weight: .4 }, "head", "DiffuseMap");
  assert.equal(layer.effect.detail.path, SHADOW + "eyeshadow_02/colorize_head_l.png");
  assert.equal(layer.effect.zone.path, SHADOW + "eyeshadow_02/colorize_head_z.png");
  assert.equal(layer.effect.recorded.Strength, .4);
  assert.deepEqual([ 1, 2, 3 ].map(area => layer.effect.recorded["Color" + area]), colors.map(color => Array.from(color)));
  assert.deepEqual(source.GetLayers({ option: "eyeshadow_02", colors, weight: .4 }, "body", "DiffuseMap"), []);
  assert.deepEqual(source.GetLayers({ option: "eyeshadow_02", colors, weight: .4 }, "head", "NormalMap"), []);
});
