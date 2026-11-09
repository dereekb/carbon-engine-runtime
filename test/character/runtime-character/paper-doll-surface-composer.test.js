import test from "node:test";
import assert from "node:assert/strict";
import { CjsCharacterRecipe, CjsPaperDollComposition, CjsPaperDollDefinition, CjsPaperDollMapDecalSource, CjsPaperDollSurfaceComposer, PaperDollTarget } from "../../../npm/dist/character/index.js";
import { installPartsLibrary } from "../../support/partsLibrary.js";
import { Tr2Effect } from "../../../npm/dist/trinity/index.js";
import "../../support/frameLoop.js";

const ROOT = "res:/graphics/character/female/paperdoll/";
const AGING = ROOT + "makeup/aging/aging_01/";
const FILES = [ AGING + "types/aging_01.type", AGING + "comp_head_tn.png", AGING + "comp_head_s.png", AGING + "comp_body_s.png",
  ROOT + "makeup/scarring/scarring_01/types/scarring_01.type", ROOT + "makeup/scarring/scarring_01/comp_head_tn.png" ];

/** The parts library over FILES, and the recipe. */
function services(t, recipe = [])
{
  installPartsLibrary(t, ROOT, FILES, { overrides: { FetchRecipe: async () => Object.assign(new CjsCharacterRecipe(), { value: [ "female", ...recipe ] }) } });
}

/** A compositor recording draws; its effects are real Tr2Effects returned through promises, as the real one does. */
class StubCompositor
{
  draws = [];
  finished = [];
  made = 0;
  async Texture(path)
  {
    const full = /\/[a-z]_(head|body)_[ns]\.dds$/.test(path);
    return { path, cutoutX: 0, cutoutY: 0, cutoutWidth: full ? 1 : .5, cutoutHeight: full ? 1 : .25, width: 2048, height: full && path.includes("_head_") ? 1024 : 2048 };
  }
  async Copy(source) { const effect = new Tr2Effect(); effect.source = source; return effect; }
  async Twist(source) { const effect = new Tr2Effect(); effect.twist = source; return effect; }
  async Simple(source) { const effect = new Tr2Effect(); effect.simple = source; return effect; }
  TargetTexture(width, height, mips) { const index = this.made++; return { target: { index, width, height, mips }, resource: { index } }; }
  Draw(target, width, height, value, region, clear = false) { this.draws.push({ target: target.index, width, height, value, clear }); }
  Finish(target) { this.finished.push(target.index); }
}

const foundation = id => ({ bindings: Object.fromEntries([ "head", "body" ].map(region => [ region,
  { NormalMap: `res:/${id}_${region}_n.dds`, SpecularMap: `res:/${id}_${region}_s.dds` } ])) });

async function prepared(t, recipe = null)
{
  services(t, recipe ?? []);
  const build = { content: { root: ROOT, sex: "female", recipe: recipe ? "res:/test.prs" : "" }, report: {}, CheckActive() {}, Ready: value => value };
  const composition = new CjsPaperDollComposition(null, build);
  const compositor = composition.compositor = new StubCompositor();
  const definition = new CjsPaperDollDefinition();
  definition.archetype.option = "a";
  const consumers = { head: [], body: [] }, notes = [];
  const surface = new CjsPaperDollSurfaceComposer(composition, build);
  const decals = await CjsPaperDollMapDecalSource.prepareAll(composition, definition, build);
  await surface.Prepare(definition, new Map([ [ "a", foundation("a") ] ]), consumers, message => notes.push(message), decals);
  return { composition, compositor, definition, consumers, surface, build, notes };
}

/** A consumer effect recording what each channel was bound to. */
function consumer()
{
  const bound = {};
  return { bound, GetResourceByName: channel => ({ SetResource: resource => { bound[channel] = resource; } }) };
}

test("the surface pass's four outputs take their sizes from the foundation's maps and carry mips; the map-decal parts are configured off", async t =>
{
  const { composition, definition } = await prepared(t);
  assert.deepEqual(composition._rows.map(row => [ row.region, row.channel, row.width, row.height, row.mips ]), [
    [ "head", "NormalMap", 2048, 1024, true ], [ "head", "SpecularMap", 2048, 1024, true ],
    [ "body", "NormalMap", 2048, 2048, true ], [ "body", "SpecularMap", 2048, 2048, true ] ]);
  assert.ok(composition.HasSource("aging") && composition.HasSource("scarring"), "every decal part has a source");
  assert.equal(definition.aging.option, "aging_01");
  assert.equal(definition.aging.enabled, false);
});

test("Apply draws each output's base, then each part's layers in the capture's order, finishes it and binds it to consumers added since", async t =>
{
  const { composition, compositor, consumers, surface, build, notes } = await prepared(t);
  await composition._sources.get("aging").Prepare("aging_01");
  const head = consumer(), body = consumer();
  consumers.head.push(head);
  consumers.body.push(body);
  const later = { GetLayers: (value, region, channel) => region === "body" && channel === "NormalMap" ? [ { effect: "later", region: new Float32Array(4) } ] : [] };
  composition.SetSource("bottomOuter", later);
  surface.Apply({ order: [ "aging", "bottomOuter" ], lists: { order: [ "aging", "bottomOuter" ] }, aging: { option: "aging_01" }, bottomOuter: { option: "x" }, scars: { option: "" }, scarring: { option: "" } });

  const byTarget = new Map();
  for (const draw of compositor.draws) byTarget.set(draw.target, [ ...(byTarget.get(draw.target) ?? []), draw ]);
  const kinds = [ ...byTarget.values() ].map(draws => draws.map(draw => draw.clear ? "base" : draw.value.twist ? "twist" : draw.value.simple ? "simple" : draw.value));
  // Head normal: base, aging's twisted tn. Head specular: base, aging's s. Body normal: base, the later source. Body
  // specular: base, aging's s.
  assert.deepEqual(kinds, [ [ "base", "twist" ], [ "base", "simple" ], [ "base", "later" ], [ "base", "simple" ] ]);
  assert.equal(compositor.finished.length, 4, "every output's mips");
  assert.deepEqual(Object.keys(head.bound).sort(), [ "NormalMap", "SpecularMap" ]);
  assert.equal(body.bound.NormalMap, composition.GetOutput(PaperDollTarget.SURFACE, "body", "NormalMap"));
  assert.equal(build.report.surfaceDetails.updates, 1);
  assert.equal(build.report.surfaceDetails.options.aging[0].regions.head.NormalMap[0].path, AGING + "comp_head_tn.png");
  assert.deepEqual(notes, [ "surface details applied" ]);
});

test("each apply draws into the other target of every output", async t =>
{
  const { composition, surface } = await prepared(t);
  const capture = { order: [], lists: { order: [] }, scars: { option: "" }, aging: { option: "" }, scarring: { option: "" } };
  surface.Apply(capture);
  const first = composition.GetOutput(PaperDollTarget.SURFACE, "head", "NormalMap");
  surface.Apply(capture);
  assert.notEqual(composition.GetOutput(PaperDollTarget.SURFACE, "head", "NormalMap"), first);
});

test("a recipe's entry for a map-decal part turns its option on and prepares it; parts it does not set stay off (operator, 2026-11-08)", async t =>
{
  const { definition, build } = await prepared(t, [ { category: "makeup", path: "makeup/scarring/scarring_01", weight: 1 } ]);
  assert.equal(definition.scarring.option, "scarring_01");
  assert.equal(definition.scarring.enabled, true);
  assert.equal(definition.aging.enabled, false);
  assert.deepEqual(build.report.surfaceDetails.options.scarring.map(option => option.id), [ "scarring_01" ], "prepared before the first apply");
});
