import test from "node:test";
import assert from "node:assert/strict";
import { CjsPaperDollComposition, CjsPaperDollDefinition, CjsPaperDollHeadComposer, CjsPaperDollInstance, CjsPaperDollMapDecalSource, PaperDollBlend, PaperDollTarget } from "../../../npm/dist/character/index.js";
import { installPartsLibrary } from "../../support/partsLibrary.js";
import { CjsCharacterRecipe } from "../../../npm/dist/character/index.js";
import { Tr2Effect } from "../../../npm/dist/trinity/index.js";
import "../../support/frameLoop.js";

const ROOT = "res:/graphics/character/female/paperdoll/";
const SCAR = ROOT + "scars/head/heroscar01/";
const FRECKLES = ROOT + "makeup/freckles/freckles_01/";
const AUG = ROOT + "makeup/augmentations/face_paint/";
const FILES = [
  SCAR + "types/heroscar01_v0.type", SCAR + "types/heroscar01_v1.type",
  SCAR + "comp_head_d.png", SCAR + "comp_head_d_256.dds", SCAR + "comp_head_mn.png", SCAR + "comp_head_tn.png", SCAR + "comp_head_s.png",
  SCAR + "v1/comp_head_d.png",
  FRECKLES + "types/freckles_01.type", FRECKLES + "comp_head_d.png", FRECKLES + "comp_body_d.png",
  AUG + "types/face_paint_v0.type", AUG + "comp_head_d.png", AUG + "comp_head_n.png", AUG + "metadata.yaml"
];

/** The parts library over FILES (its types name their folder and the variation their name ends in), and the recipe. */
function services(t, recipe = [])
{
  installPartsLibrary(t, ROOT, FILES, {
    text: { [AUG + "metadata.yaml"]: "!!python/object:paperDoll.AvatarPartMetaData\ndependantModifiers: null\noccludesModifiers: [accessories/browbase###0.5, accessories/browbase]\n" },
    overrides: { FetchRecipe: async () => Object.assign(new CjsCharacterRecipe(), { value: [ "female", ...recipe ] }) }
  });
}

/** A compositor recording draws and how each layer was made. */
class StubCompositor
{
  draws = [];
  finished = [];
  made = 0;
  async Texture(path)
  {
    const small = !path.endsWith("comp_head_s.png") && !path.includes("_base");
    return { path, cutoutX: 0, cutoutY: 0, cutoutWidth: small ? .25 : 1, cutoutHeight: small ? .125 : 1, width: 512, height: small ? 128 : 1024 };
  }
  effect(kind, source, mask = null) { const effect = new Tr2Effect(); Object.assign(effect, { kind, source, mask }); return effect; }
  async Copy(source) { const effect = this.effect("copy", source); effect.bound = null; effect.GetResourceByName = () => ({ SetResource: value => { effect.bound = value; } }); return effect; }
  async Simple(source, region, mask = source) { return this.effect("simple", source, mask === source ? null : mask); }
  async Twist(source) { return this.effect("twist", source); }
  async MaskedNormal(source) { return this.effect("masked", source); }
  TargetTexture(width, height, mips) { const index = this.made++; return { target: { index, width, height, mips }, resource: { index } }; }
  Draw(target, width, height, value, region, clear = false) { this.draws.push({ target: target.index, value, region: Array.from(region), clear }); }
  Finish(target) { this.finished.push(target.index); }
}

async function prepared(t, recipe = null)
{
  services(t, recipe ?? []);
  const build = { content: { root: ROOT, sex: "female", recipe: recipe ? "res:/test.prs" : "" }, report: {}, CheckActive() {}, Ready: value => value };
  const composition = new CjsPaperDollComposition(null, build);
  const compositor = composition.compositor = new StubCompositor();
  const definition = new CjsPaperDollDefinition();
  const decals = await CjsPaperDollMapDecalSource.prepareAll(composition, definition, build);
  return { build, composition, compositor, definition, decals };
}

const short = path => path.slice(ROOT.length);

test("prepareAll makes a source for each part whose class blends as a decal; a part the recipe does not set starts with no option, off", async t =>
{
  const { composition, definition, decals } = await prepared(t);
  assert.deepEqual([ ...decals.keys() ].sort(), [ "aging", "augmentations", "freckles", "scarring", "scars" ]);
  assert.ok([ ...decals.keys() ].every(name => definition[name].constructor.blend === PaperDollBlend.DECAL));
  assert.ok(composition.HasSource("scars") && composition.HasSource("freckles"));
  assert.deepEqual(definition.scars.GetOptions().map(option => option.id), [ "heroscar01_v0", "heroscar01_v1" ], "an option is its type file's name");
  assert.equal(definition.scars.option, "", "no code-picked option: the character factory's defaults set what starts on");
  assert.equal(definition.scars.enabled, false);
  assert.equal(definition.freckles.enabled, false);
});

test("a recipe's entry turns its option on and prepares it; one the part does not list throws", async t =>
{
  const { definition, decals } = await prepared(t, [ { category: "makeup", path: "makeup/freckles/freckles_01", weight: 1 } ]);
  assert.equal(definition.freckles.option, "freckles_01");
  assert.equal(definition.freckles.enabled, true);
  assert.deepEqual(decals.get("freckles").Describe().map(option => Object.keys(option.regions).sort()), [ [ "body", "head" ] ]);
  await assert.rejects(prepared(t, [ { category: "makeup", path: "makeup/freckles/freckles_09" } ]), /does not list/);
});

test("a scar draws its masked normal before its twist, and its specular through its diffuse alpha at the diffuse's cutout", async t =>
{
  const { decals } = await prepared(t);
  const scars = decals.get("scars");
  await scars.Prepare("heroscar01_v0");
  const value = { option: "heroscar01_v0" };
  assert.deepEqual(scars.GetLayers(value, "head", "NormalMap").map(layer => layer.effect.kind), [ "masked", "twist" ]);
  const [ diffuse ] = scars.GetLayers(value, "head", "DiffuseMap"), [ specular ] = scars.GetLayers(value, "head", "SpecularMap");
  assert.equal(short(diffuse.effect.source.path), "scars/head/heroscar01/comp_head_d.png", "the png, not the legacy dds");
  assert.equal(short(specular.effect.source.path), "scars/head/heroscar01/comp_head_s.png");
  assert.equal(specular.effect.mask, diffuse.effect.source, "masked by the diffuse");
  assert.deepEqual(Array.from(specular.region), Array.from(diffuse.region), "placed at the diffuse's cutout, not its own full one");
  assert.deepEqual(scars.GetLayers(value, "body", "DiffuseMap"), []);
});

test("a variation's maps replace the part folder's of the same name; the others stay", async t =>
{
  const { decals } = await prepared(t);
  const scars = decals.get("scars");
  await scars.Prepare("heroscar01_v1");
  const value = { option: "heroscar01_v1" };
  assert.equal(short(scars.GetLayers(value, "head", "DiffuseMap")[0].effect.source.path), "scars/head/heroscar01/v1/comp_head_d.png");
  assert.equal(short(scars.GetLayers(value, "head", "SpecularMap")[0].effect.source.path), "scars/head/heroscar01/comp_head_s.png");
  assert.equal(scars.GetLayers(value, "head", "SpecularMap")[0].effect.mask.path.endsWith("v1/comp_head_d.png"), true, "masked by the variation's diffuse");
});

test("an augmentation draws its normal through its diffuse, and its option reports its path and what its metadata occludes", async t =>
{
  const { definition, decals } = await prepared(t);
  const augmentations = decals.get("augmentations");
  const record = await definition.augmentations.ResolveOption("face_paint_v0");
  assert.equal(record.path, "makeup/augmentations/face_paint");
  assert.deepEqual(record.occludes, [ "accessories/browbase" ], "weights dropped, repeats merged");
  assert.ok(augmentations.IsPrepared("face_paint_v0"));
  const [ normal ] = augmentations.GetLayers({ option: "face_paint_v0" }, "head", "NormalMap");
  assert.equal(normal.effect.mask.path, AUG + "comp_head_d.png");
});

test("a composition row draws its base into its region and draws the ready list it names, as given", async t =>
{
  const { composition, compositor } = await prepared(t);
  const layer = name => ({ GetLayers: () => [ { effect: name, region: new Float32Array(4) } ] });
  for (const name of [ "a", "eyebrows", "b" ]) composition.SetSource(name, layer(name));
  composition.AddOutput({ target: PaperDollTarget.HEAD, region: "head", channel: "DiffuseMap", width: 4, height: 2, base: () => "base", baseRegion: () => Float32Array.of(.5, .5, .25, .25), list: "brow" });
  composition.Render(PaperDollTarget.HEAD, { order: [ "a", "eyebrows", "b" ], lists: { order: [ "a", "eyebrows", "b" ], brow: [ "b" ] } });
  assert.deepEqual(compositor.draws.map(draw => draw.value), [ "base", "b" ]);
  assert.deepEqual(compositor.draws[0].region, [ .5, .5, .25, .25 ]);
  assert.throws(() => composition.Render(PaperDollTarget.HEAD, { order: [ "a", "b" ], lists: { order: [ "a", "b" ] } }), /no ready list brow/);
  assert.throws(() => composition.GetOutput(PaperDollTarget.HEAD, "head", "DiffuseMap"), /No composition output/, "a row drawing another list is not an output");
});

test("the head composer sizes both outputs from the foundation's head diffuse, bases the face on the skin's head output and draws its first state", async t =>
{
  const { composition, compositor, definition } = await prepared(t);
  const skinRow = composition.AddOutput({ target: PaperDollTarget.SKIN, region: "head", channel: "DiffuseMap", width: 512, height: 256, base: () => "skin" });
  const brow = { effect: "carrier" }, bound = [], browBound = [];
  composition.SetSource("eyebrows", { GetLayers: (value, region) => region === "head" ? [ { effect: "brow paint", region: new Float32Array(4) } ] : [] });
  const head = new CjsPaperDollHeadComposer(composition, { Ready: value => value });
  await head.Prepare(definition, ROOT + "f_head_base.png", [ resource => bound.push(resource) ], {
    base: () => brow, region: () => Float32Array.of(.1, .1, .2, .2), consumers: [ resource => browBound.push(resource) ]
  });
  const rows = composition._rows.filter(row => row.target === PaperDollTarget.HEAD);
  assert.deepEqual(rows.map(row => [ row.width, row.height, row.mips, row.list ]), [ [ 512, 1024, true, "order" ], [ 512, 1024, true, "brow" ] ]);
  const faceBase = compositor.draws.find(draw => draw.value.kind === "copy");
  assert.equal(faceBase.value.bound, skinRow.buffers[skinRow.active].resource, "the face's base is the skin's head output");
  assert.equal(compositor.draws.filter(draw => draw.value === "brow paint").length, 1, "the brow paint draws on the face, not on the brow target");
  assert.equal(head.GetBrowTexture(), rows[1].buffers[rows[1].active].resource);
  assert.deepEqual([ bound.length, browBound.length ], [ 0, 0 ], "the first draw binds nothing");
  head.Apply(CjsPaperDollInstance.ready(definition, PaperDollTarget.HEAD));
  assert.deepEqual([ bound.length, browBound.length ], [ 1, 1 ]);
});
