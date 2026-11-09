import test from "node:test";
import assert from "node:assert/strict";
import { CjsPaperDollComposition, CjsPaperDollDefinition, CjsPaperDollEyesComposer, CjsPaperDollMakeupCatalog, PaperDollTarget } from "../../../npm/dist/character/index.js";
import { Tr2Effect } from "../../../npm/dist/trinity/index.js";
import { installPartsLibrary } from "../../support/partsLibrary.js";

const ROOT = "res:/graphics/character/female/paperdoll/";
const COLOURED = ROOT + "makeup/eyes/eyes_01/", PLAIN = ROOT + "makeup/eyes/eyes_02/";
const FILES = [
  COLOURED + "types/eyes_01.type", COLOURED + "colorize_head_l.png", COLOURED + "colorize_head_z.png", COLOURED + "comp_head_n.png", COLOURED + "comp_head_s.png",
  PLAIN + "types/eyes_02.type", PLAIN + "comp_head_d.png", PLAIN + "comp_head_n.png", PLAIN + "comp_head_s.png", PLAIN + "default.color",
  ROOT + "makeup/eyes/colors/blue.color"
];
const COLOURS = [ [ .1, .2, .3, 1 ], [ .4, .5, .6, 1 ], [ .7, .8, .9, 1 ] ];

function services(t)
{
  const overrides = { FetchType: async path => ({ value: [ path.slice(ROOT.length, path.indexOf("/types/")), "", "" ] }) };
  installPartsLibrary(t, ROOT, FILES, { overrides });
}

/** A compositor recording draws; effects are real Tr2Effects through promises, as the real one returns them. */
class StubCompositor
{
  draws = [];
  made = 0;
  async Texture(path) { return { path, cutoutX: 0, cutoutY: 0, cutoutWidth: .5, cutoutHeight: .5, width: 64, height: 64 }; }
  async Copy(source, region, normal) { const effect = new Tr2Effect(); Object.assign(effect, { copy: source, normal }); return effect; }
  async Colorized(detail) { const effect = new Tr2Effect(); effect.colorized = detail; return effect; }
  async Simple(detail) { const effect = new Tr2Effect(); effect.simple = detail; return effect; }
  async ColorAreas() { return [ 1, 2, 3 ]; }
  TargetTexture(width, height) { const index = this.made++; return { target: { index, width, height }, resource: { index } }; }
  Draw(target, width, height, value, region, clear = false, writeRGBA = clear) { this.draws.push({ target: target.index, width, height, value, clear, writeRGBA }); }
}

/** An EyeShader consumer whose maps are the given resources. */
function consumer(maps)
{
  const bound = { ...maps };
  return { mesh: { name: "eyeShape", meshIndex: 3 }, bound, effect: { GetResourceByName: name => ({ GetResource: () => bound[name], SetResource: value => { bound[name] = value; } }) } };
}

async function prepared(t)
{
  services(t);
  const build = { content: { root: ROOT, sex: "female" }, report: {}, CheckActive() {}, Ready: value => value };
  const composition = new CjsPaperDollComposition(null, build);
  const compositor = composition.compositor = new StubCompositor();
  const definition = new CjsPaperDollDefinition();
  const maps = { DiffuseMap: { name: "d", width: 1024, height: 512 }, NormalMap: { name: "n" }, SpecularMap: { name: "s" } };
  const consumers = [ consumer(maps), consumer(maps) ];
  const eyes = new CjsPaperDollEyesComposer(composition, build);
  await eyes.Prepare(definition, consumers, () => {});
  return { composition, compositor, definition, consumers, eyes, build, maps };
}

test("the makeup catalogue reads each type's channels, palettes and default palette (Graphene's componentCatalog moved)", async t =>
{
  services(t);
  const catalog = await CjsPaperDollMakeupCatalog.read("eyes", { content: { root: ROOT, sex: "female" }, Ready: value => value });
  assert.deepEqual(catalog.options.map(option => option.id), [ "eyes_01", "eyes_02" ]);
  assert.deepEqual(Object.keys(catalog.options[0].channels).sort(), [ "colorize_head_l", "colorize_head_z", "comp_head_n", "comp_head_s" ]);
  assert.equal(catalog.options[1].defaultPalette, PLAIN + "default.color");
  assert.deepEqual(catalog.options[0].palettes.map(value => value.label), [ "blue" ]);
});

test("the eyes' three outputs are the consumers' diffuse size; an unresolved option binds the consumers' own maps back", async t =>
{
  const { composition, eyes, consumers, maps, build } = await prepared(t);
  assert.deepEqual(composition._rows.map(row => [ row.channel, row.width, row.height ]), [ [ "DiffuseMap", 1024, 512 ], [ "NormalMap", 1024, 512 ], [ "SpecularMap", 1024, 512 ] ]);
  consumers[0].bound.DiffuseMap = "elsewhere";
  eyes.Apply({ order: [ "eyes" ], lists: { order: [ "eyes" ] }, eyes: { option: "eyes_01", colors: COLOURS } });
  assert.equal(consumers[0].bound.DiffuseMap, maps.DiffuseMap, "eyes_01 is not resolved yet");
  assert.equal(build.report.eyes.selected, "eyes_01");
});

test("a resolved coloured option draws its colourised diffuse, and its normal and specular as RGBA material data", async t =>
{
  const { composition, compositor, definition, eyes, consumers } = await prepared(t);
  await definition.eyes.ResolveOption("eyes_01");
  eyes.Apply({ order: [ "eyes" ], lists: { order: [ "eyes" ] }, eyes: { option: "eyes_01", colors: COLOURS } });
  const layers = compositor.draws.filter(draw => !draw.clear);
  assert.equal(layers.length, 3);
  assert.ok(layers[0].value.colorized && !layers[0].writeRGBA);
  assert.deepEqual(Array.from(layers[0].value.FindParameterByName("Color1").value), COLOURS[0].map(Math.fround));
  assert.ok(layers[1].value.normal === true && layers[1].writeRGBA, "normal patch");
  assert.ok(layers[2].value.normal === false && layers[2].writeRGBA, "specular patch");
  for (const { bound } of consumers) assert.equal(bound.NormalMap, composition.GetOutput(PaperDollTarget.EYES, "eyes", "NormalMap"));
});
