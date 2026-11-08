import test from "node:test";
import assert from "node:assert/strict";
import { CjsCharacterRecipe, CjsCharacterRecipeModifier, CjsPaperDollColorizedSource, CjsPaperDollDefinition } from "../../../npm/dist/character/index.js";
import { BluePaths, BlueResFileSystemRemote, RemoteFileCache } from "../../../npm/dist/blue/index.js";
import { installBlueServices } from "../../../npm/dist/blue/blue.js";
import { Tr2Effect } from "../../../npm/dist/trinity/index.js";
import "../../support/frameLoop.js";

const ROOT = "res:/graphics/character/female/paperdoll/";
const BLUSH = ROOT + "makeup/blush/";
const FILES = [
  BLUSH + "blush_01/types/blush_01.type", BLUSH + "blush_01/colorize_head_l.png", BLUSH + "blush_01/colorize_head_z.png",
  BLUSH + "blush_02/types/blush_02.type", BLUSH + "blush_02/colorize_head_l.png", BLUSH + "blush_02/colorize_head_z.png", BLUSH + "blush_02/default.color",
  BLUSH + "colors/rose.color", BLUSH + "colors/peach.color"
];
/** Each palette's colours: rose and blush_02's default are the same colours, so they merge. */
const PALETTES = { "colors/rose.color": .3, "colors/peach.color": .6, "blush_02/default.color": .3 };

function services(t, entries)
{
  const cache = new RemoteFileCache();
  cache.AddFileIndex(FILES.map((path, index) => `${path},synthetic/${index},checksum,1`).join("\n"));
  const paths = new BluePaths();
  paths.RegisterFileSystem(new BlueResFileSystemRemote(cache));
  const recipe = Object.assign(new CjsCharacterRecipe(), { value: [ "female", ...entries.map(entry => Object.assign(new CjsCharacterRecipeModifier(), entry)) ] });
  const characterLibrary = {
    FetchRecipe: async () => recipe,
    FetchType: async path => ({ value: [ path.slice(ROOT.length, path.indexOf("/types/")), "", "" ] }),
    FetchAvatarPartMetaData: async () => null,
    FetchPalette: async path => ({ colors: [ 0, 1, 2 ].map(() => Float32Array.of(PALETTES[path.slice(BLUSH.length)], 0, 0, 1)) })
  };
  const previous = installBlueServices({ paths, characterLibrary }, false);
  t.after(() => installBlueServices(previous, previous.running));
}

class StubCompositor
{
  async Texture(path) { return { path, cutoutX: 0, cutoutY: 0, cutoutWidth: .5, cutoutHeight: .25, width: 512, height: 256 }; }
  async Colorized(detail, region, zone) { const effect = new Tr2Effect(); Object.assign(effect, { detail, zone }); return effect; }
  async ColorAreas() { return [ 1, 2 ]; }
}

async function configured(t, entries = [])
{
  services(t, entries);
  const build = { content: { root: ROOT, recipe: "res:/test.prs" }, CheckActive() {}, Ready: value => value };
  const definition = new CjsPaperDollDefinition();
  const source = new CjsPaperDollColorizedSource(new StubCompositor(), build, "blush");
  await source.ConfigureCatalog(definition);
  return { definition, source };
}

test("the catalog lists every option's palettes as raw records, unmerged; an option's default is its own default only", async t =>
{
  const { definition } = await configured(t);
  const [ first, second ] = definition.blush.GetOptions();
  assert.deepEqual(first.palettes.map(record => record.name).sort(), [ "peach", "rose" ]);
  assert.deepEqual(second.palettes.map(record => record.name).sort(), [ "default", "peach", "rose" ], "equal colours are not merged here: the menu's");
  assert.equal(first.defaultPalette, undefined, "no own default and no recipe: none");
  assert.equal(second.defaultPalette, BLUSH + "blush_02/default.color");
  assert.equal(definition.blush.enabled, false, "no recipe entry: off");
  assert.equal(definition.blush.weight, 0, "no recipe entry: weight 0");
});

test("a recipe entry turns its option on at its weight; its colours are the default of options without their own (provisional: an own default wins)", async t =>
{
  const { definition, source } = await configured(t, [ { category: "makeup", path: "makeup/blush/blush_02", colors: "[(0.9, 0.1, 0.1, 1.0), (0.9, 0.1, 0.1, 1.0), (0.9, 0.1, 0.1, 1.0)]", weight: .06 } ]);
  const blush = definition.blush;
  assert.equal(blush.enabled, true);
  assert.equal(blush.option, "blush_02");
  assert.equal(blush.weight, .06);
  const [ first, second ] = blush.GetOptions();
  assert.equal(second.defaultPalette, BLUSH + "blush_02/default.color", "the recipe's option keeps its own default (provisional)");
  assert.equal(first.defaultPalette, CjsPaperDollColorizedSource.authored, "an option without its own");
  assert.ok(first.palettes.some(record => record.path === CjsPaperDollColorizedSource.authored));
  assert.equal(Math.round(blush.GetPaletteColors(CjsPaperDollColorizedSource.authored)[0][0] * 10) / 10, .9);
  assert.ok(source.IsPrepared("blush_02"), "the recipe's option draws from the first apply");
  await assert.rejects(configured(t, [ { category: "makeup", path: "makeup/blush/blush_01", colors: "", weight: Number.NaN } ]), /Invalid blush recipe entry/, "a weight that is not a number");
});
