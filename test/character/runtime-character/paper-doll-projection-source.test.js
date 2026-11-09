import test from "node:test";
import assert from "node:assert/strict";
import { CjsCharacterRecipe, CjsCharacterRecipeModifier, CjsPaperDollColorizedSource, CjsPaperDollDefinition, CjsPaperDollProjectionSource, PaperDollPalettes } from "../../../npm/dist/character/index.js";
import { Tr2Effect } from "../../../npm/dist/trinity/index.js";
import { installPartsLibrary } from "../../support/partsLibrary.js";

const ROOT = "res:/graphics/character/male/paperdoll/";
const HEAD = ROOT + "tattoo/head/";
const FILES = [
  HEAD + "colors/basecolor.base", HEAD + "colors/blue_a.color", HEAD + "colors/default_a.color",
  HEAD + "tattoofacea01/comp_head_z.png", HEAD + "tattoofacea01/projection.proj", HEAD + "tattoofacea01/types/tattoofacea01.type",
  HEAD + "tattoofacem02/comp_head_z.png", HEAD + "tattoofacem02/projection.proj", HEAD + "tattoofacem02/types/tattoofacem02.type",
  // The two male folders without a `.type`.
  HEAD + "tattooface01/projection.proj",
  HEAD + "tattoofacetest/comp_head_z.png", HEAD + "tattoofacetest/projection.proj",
  // Arm projections are the body's.
  ROOT + "tattoo/armleft/sleeve01/sleeve01.proj"
];

function services(t, entries, files = FILES)
{
  const recipe = Object.assign(new CjsCharacterRecipe(), { value: [ "male", ...entries.map(entry => Object.assign(new CjsCharacterRecipeModifier(), entry)) ] });
  installPartsLibrary(t, ROOT, files, { overrides: { FetchRecipe: async () => recipe, FetchMaterialMaskAreas__Zone: async () => [ 1 ] } });
}

/** A compositor recording each effect, its inputs and the colours set on it. */
class StubCompositor
{
  targets = [];
  async Texture(path) { return { path, cutoutX: 0, cutoutY: 0, cutoutWidth: 1, cutoutHeight: 1, width: 16, height: 16 }; }
  TargetTexture(width, height) { const target = { width, height, resource: { bake: true } }; this.targets.push(target); return target; }
  async Colorized(detail, region, zone) { const effect = new Tr2Effect(); Object.assign(effect, { detail, zone, recorded: {} }); effect.SetParameter__Vector4 = (name, value) => { effect.recorded[name] = Array.from(value); }; return effect; }
}

async function configured(t, entries = [], files = FILES)
{
  services(t, entries, files);
  const build = { content: { root: ROOT, sex: "male", recipe: "res:/test.prs" }, CheckActive() {}, Ready: value => value };
  const definition = new CjsPaperDollDefinition(), compositor = new StubCompositor();
  const source = new CjsPaperDollProjectionSource(compositor, build, "tattoo");
  await source.Configure(definition);
  return { definition, source, compositor };
}

test("the head tattoo options are its .types; folders without one are reported, not listed", async t =>
{
  const { definition, source } = await configured(t);
  assert.equal(definition.tattoo.constructor.palettes, PaperDollPalettes.CATALOG);
  assert.deepEqual(definition.tattoo.GetOptions().map(option => option.id), [ "tattoofacea01", "tattoofacem02" ]);
  assert.deepEqual(source.Describe(), { options: [ "tattoofacea01", "tattoofacem02" ], unlisted: [ "tattooface01", "tattoofacetest" ] });
  assert.equal(source.GetProjection("tattoofacem02"), HEAD + "tattoofacem02/projection.proj");
  const option = definition.tattoo.GetOptions()[0];
  assert.equal(option.defaultPalette, undefined, "no code-picked ink: the character factory's defaults set it");
  assert.deepEqual(option.palettes.map(record => record.name), [ "blue_a", "default_a" ]);
  assert.equal(definition.tattoo.enabled, false, "no recipe entry: off");
});

test("an option paints its zone over the bake target once the host has baked it", async t =>
{
  const { definition, source, compositor } = await configured(t);
  assert.deepEqual([ compositor.targets[0].width, compositor.targets[0].height ], [ 2048, 1024 ]);
  assert.equal(source.GetBakeTarget(), compositor.targets[0]);
  await definition.tattoo.ResolveOption("tattoofacea01");
  const colours = [ 0, 1, 2 ].map(i => Float32Array.of(i / 4, 0, 0, 1)), value = { option: "tattoofacea01", colors: colours };
  assert.deepEqual(source.GetLayers(value, "head", "DiffuseMap"), [], "no baker yet");
  const baked = [];
  let ready = false;
  source.SetBaker(id => { baked.push(id); return ready; });
  assert.deepEqual(source.GetLayers(value, "head", "DiffuseMap"), [], "inputs loading");
  ready = true;
  const [ layer ] = source.GetLayers(value, "head", "DiffuseMap");
  assert.equal(layer.effect.detail, compositor.targets[0].resource);
  assert.equal(layer.effect.zone.path, HEAD + "tattoofacea01/comp_head_z.png");
  assert.deepEqual(layer.effect.recorded.Color2, [ .25, 0, 0, 1 ]);
  assert.deepEqual(baked, [ "tattoofacea01", "tattoofacea01" ]);
  assert.deepEqual(source.GetLayers(value, "body", "DiffuseMap"), []);
  assert.deepEqual(source.GetLayers(value, "head", "NormalMap"), []);
});

