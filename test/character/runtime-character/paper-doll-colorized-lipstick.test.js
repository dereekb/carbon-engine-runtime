import test from "node:test";
import assert from "node:assert/strict";
import { CjsCharacterRecipe, CjsCharacterRecipeModifier, CjsPaperDollColorizedSource, CjsPaperDollDefinition } from "../../../npm/dist/character/index.js";
import { BluePaths, BlueResFileSystemRemote, RemoteFileCache } from "../../../npm/dist/blue/index.js";
import { installBlueServices } from "../../../npm/dist/blue/blue.js";
import { Tr2Effect } from "../../../npm/dist/trinity/index.js";
import "../../support/frameLoop.js";

const ROOT = "res:/graphics/character/female/paperdoll/";
const LIP = ROOT + "makeup/lipstick/";
const FILES = [
  LIP + "lipstick_01/types/lipstick_01.type", LIP + "lipstick_01/colorize_head_l.png", LIP + "lipstick_01/colorize_head_z.png", LIP + "lipstick_01/comp_head_s.png",
  LIP + "lipstick_01/red_medium.color",
  // A style without a specular map, as every male lipstick is.
  LIP + "lipstick_02/types/lipstick_02.type", LIP + "lipstick_02/colorize_head_l.png", LIP + "lipstick_02/colorize_head_z.png", LIP + "lipstick_02/pink.color"
];

function services(t, entries)
{
  const cache = new RemoteFileCache();
  cache.AddFileIndex(FILES.map((path, index) => `${path},synthetic/${index},checksum,1`).join("\n"));
  const paths = new BluePaths();
  paths.RegisterFileSystem(new BlueResFileSystemRemote(cache));
  const recipe = Object.assign(new CjsCharacterRecipe(), { value: [ "female", ...entries.map(entry => Object.assign(new CjsCharacterRecipeModifier(), entry)) ] });
  const grey = () => [ 0, 1, 2 ].map(() => Float32Array.of(.5, .5, .5, 1));
  const characterLibrary = {
    FetchRecipe: async () => recipe,
    FetchPalette: async () => ({ colors: grey(), specularColors: grey() }),
    FetchMaterialMaskAreas__Zone: async () => [ 1 ]
  };
  const previous = installBlueServices({ paths, characterLibrary }, false);
  t.after(() => installBlueServices(previous, previous.running));
}

/** A compositor recording each effect and the parameters set on it. */
class StubCompositor
{
  async Texture(path) { return { path, cutoutX: 0, cutoutY: 0, cutoutWidth: .25, cutoutHeight: .125, width: 256, height: 128 }; }
  effect(kind, source) { const effect = new Tr2Effect(); Object.assign(effect, { kind, source, recorded: {} }); effect.SetParameter = (name, value) => { effect.recorded[name] = value; }; effect.SetParameter__Vector4 = (name, value) => { effect.recorded[name] = Array.from(value); }; return effect; }
  async Colorized(detail) { return this.effect("colorized", detail); }
  async ColorizedMasked(source) { return this.effect("colorizedMasked", source); }
  async BlitIntoAlphaWithZones(source) { return this.effect("gloss", source); }
}

async function configured(t, entries = [])
{
  services(t, entries);
  const build = { content: { root: ROOT, recipe: "res:/test.prs" }, CheckActive() {}, Ready: value => value };
  const definition = new CjsPaperDollDefinition();
  const source = new CjsPaperDollColorizedSource(new StubCompositor(), build, "lipstick");
  await source.Configure(definition);
  return { definition, source };
}

const specular = [ Float32Array.of(.1, .2, .3, 1.3), Float32Array.of(.4, .5, .6, 1.2), Float32Array.of(.7, .8, .9, 0) ];

test("a style with a specular map draws its specular colour and gloss in the applied palette's specular colours", async t =>
{
  const { definition, source } = await configured(t);
  await definition.lipstick.ResolveOption("lipstick_01");
  const value = { option: "lipstick_01", palette: LIP + "lipstick_01/red_medium.color", colors: specular, specularColors: specular };
  const [ colour, gloss ] = source.GetLayers(value, "head", "SpecularMap");
  assert.equal(colour.effect.kind, "colorizedMasked");
  assert.equal(colour.effect.source.path, LIP + "lipstick_01/comp_head_s.png");
  assert.deepEqual(colour.effect.recorded.Color1.map(v => Math.round(v * 10) / 10), [ .1, .2, .3, 1.3 ]);
  assert.equal(gloss.effect.kind, "gloss");
  assert.deepEqual(gloss.effect.recorded.Color1.map(v => Math.round(v * 10) / 10), [ 1.3, 1.2, 0, 0 ], "each area's gloss is its specular colour's W");
  assert.deepEqual(source.GetLayers({ ...value, palette: "" }, "head", "SpecularMap"), [], "custom colours: no palette, no specular");
  assert.equal(source.GetLayers(value, "head", "DiffuseMap").length, 1);
  assert.equal(source.GetLayers(value, "head", "DiffuseMap")[0].effect.recorded.Strength, undefined, "lipstick has no weight: full strength");
});

test("a style without a specular map draws its diffuse only (the male lipstick)", async t =>
{
  const { definition, source } = await configured(t);
  await definition.lipstick.ResolveOption("lipstick_02");
  const value = { option: "lipstick_02", palette: LIP + "lipstick_02/pink.color", colors: specular, specularColors: specular };
  assert.deepEqual(source.GetLayers(value, "head", "SpecularMap"), []);
  assert.equal(source.GetLayers(value, "head", "DiffuseMap").length, 1);
});

test("a recipe entry's specular colours ride with its authored palette", async t =>
{
  const { definition } = await configured(t, [ { category: "makeup", path: "makeup/lipstick/lipstick_01", colors: "[(0.8, 0.1, 0.1, 1.0), (0.5, 0.5, 0.5, 1.0), (0.5, 0.5, 0.5, 1.0)]", weight: .1,
    specularColor1: Float32Array.of(.9, .9, .9, 1.4) } ]);
  const lipstick = definition.lipstick;
  assert.equal(lipstick.enabled, true);
  assert.equal(lipstick.GetOptions().find(option => option.id === "lipstick_01").defaultPalette, CjsPaperDollColorizedSource.authored);
  assert.deepEqual(Array.from(lipstick.GetPaletteSpecularColors(CjsPaperDollColorizedSource.authored)[0], v => Math.round(v * 10) / 10), [ .9, .9, .9, 1.4 ]);
  assert.equal(lipstick.GetPaletteSpecularColors(LIP + "lipstick_01/red_medium.color"), null, "a palette file holds its own");
});
