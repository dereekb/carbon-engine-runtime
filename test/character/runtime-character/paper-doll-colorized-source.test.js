import test from "node:test";
import assert from "node:assert/strict";
import { CjsCharacterRecipe, CjsCharacterRecipeModifier, CjsPaperDollColorizedSource, CjsPaperDollDefinition } from "../../../npm/dist/character/index.js";
import { BluePaths, BlueResFileSystemRemote, RemoteFileCache } from "../../../npm/dist/blue/index.js";
import { installBlueServices } from "../../../npm/dist/blue/blue.js";
import { Tr2Effect } from "../../../npm/dist/trinity/index.js";
import "../../support/frameLoop.js";

const ROOT = "res:/graphics/character/female/paperdoll/";
const SHADOW = ROOT + "makeup/eyeshadow/";
const FILES = [
  SHADOW + "eyeshadow_01/types/eyeshadow_01.type", SHADOW + "eyeshadow_01/colorize_head_l.png", SHADOW + "eyeshadow_01/colorize_head_z.png",
  SHADOW + "eyeshadow_01/aqua_a.color", SHADOW + "eyeshadow_01/aqua_bc.color", SHADOW + "eyeshadow_01/blue_a.color", SHADOW + "eyeshadow_01/blue_bc.color",
  SHADOW + "eyeshadow_02/types/eyeshadow_02.type", SHADOW + "eyeshadow_02/colorize_head_l.png", SHADOW + "eyeshadow_02/colorize_head_z.png",
  SHADOW + "eyeshadow_02/default.color", SHADOW + "eyeshadow_02/red.color", SHADOW + "eyeshadow_02/aa_female_head_s_4k.png"
];
const RECIPE_COLOURS = "[(0.1, 0.2, 0.3, 1.0), (0.4, 0.5, 0.6, 1.0), (0.7, 0.8, 0.9, 1.0)]";

function services(t, entries = [])
{
  const cache = new RemoteFileCache();
  cache.AddFileIndex(FILES.map((path, index) => `${path},synthetic/${index},checksum,1`).join("\n"));
  const paths = new BluePaths();
  paths.RegisterFileSystem(new BlueResFileSystemRemote(cache));
  const recipe = Object.assign(new CjsCharacterRecipe(), { value: [ "female", ...entries.map(entry => Object.assign(new CjsCharacterRecipeModifier(), entry)) ] });
  const characterLibrary = {
    FetchRecipe: async () => recipe,
    FetchPalette: async path => ({ colors: [ 0, 1, 2 ].map(() => Float32Array.of(path.length / 100, 0, 0, 1)) }),
    FetchMaterialMaskAreas__Zone: async () => [ 1, 2, 3 ]
  };
  const previous = installBlueServices({ paths, characterLibrary }, false);
  t.after(() => installBlueServices(previous, previous.running));
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

async function configured(t, entries)
{
  services(t, entries ?? []);
  const build = { content: { root: ROOT, recipe: entries ? "res:/test.prs" : "" }, CheckActive() {}, Ready: value => value };
  const definition = new CjsPaperDollDefinition();
  const source = new CjsPaperDollColorizedSource(new StubCompositor(), build, "eyeshadow");
  await source.Configure(definition);
  return { definition, source };
}

test("the swatch rule lists each style with its own palettes; a style with swatches is picked by swatch", async t =>
{
  const { definition } = await configured(t, null);
  const [ first, second ] = definition.eyeshadow.GetOptions();
  assert.deepEqual(first.palettes.map(record => record.label), [ "Aqua", "Blue" ]);
  assert.deepEqual(first.secondaryPalettes.map(record => record.label), [ "Aqua", "Blue" ]);
  assert.equal(first.defaultPalette, SHADOW + "eyeshadow_01/aqua_a.color", "the first by label without default.color");
  assert.equal(second.defaultPalette, SHADOW + "eyeshadow_02/default.color");
  assert.equal(definition.eyeshadow.enabled, false, "no recipe entry: off");
  assert.equal(definition.eyeshadow.option, "");
});

test("a recipe entry turns its style on at its weight, with its colours as the style's default palette and no secondary", async t =>
{
  const { definition } = await configured(t, [ { category: "makeup", path: "makeup/eyeshadow/eyeshadow_01", colors: RECIPE_COLOURS, weight: .25 } ]);
  const component = definition.eyeshadow;
  assert.equal(component.enabled, true);
  assert.equal(component.option, "eyeshadow_01");
  assert.equal(component.weight, .25);
  const option = component.GetOptions().find(value => value.id === "eyeshadow_01");
  assert.equal(option.defaultPalette, CjsPaperDollColorizedSource.authored);
  assert.equal(option.defaultSecondaryPalette, undefined, "the recipe's colours fill all three areas");
  assert.deepEqual(component.GetPaletteColors(CjsPaperDollColorizedSource.authored).map(color => Array.from(color, value => Math.round(value * 10) / 10)),
    [ [ .1, .2, .3, 1 ], [ .4, .5, .6, 1 ], [ .7, .8, .9, 1 ] ]);
  assert.equal(component.GetOptions().find(value => value.id === "eyeshadow_02").defaultPalette, SHADOW + "eyeshadow_02/default.color");
  await assert.rejects(configured(t, [ { category: "makeup", path: "makeup/eyeshadow/eyeshadow_09", colors: RECIPE_COLOURS, weight: 1 } ]), /does not list/);
});

test("a style's paint draws in the captured colours at the captured weight, into the head diffuse only", async t =>
{
  const { definition, source } = await configured(t, null);
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
