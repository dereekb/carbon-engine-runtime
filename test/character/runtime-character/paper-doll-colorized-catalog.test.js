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

test("the catalog rule merges every option's palettes by value into one menu", async t =>
{
  const { definition } = await configured(t);
  const [ first, second ] = definition.blush.GetOptions();
  assert.deepEqual(first.palettes.map(record => record.path).sort(), [ BLUSH + "colors/peach.color", BLUSH + "colors/rose.color" ].sort(),
    "blush_02's default is rose's colours, so it aliases rose");
  assert.equal(second.defaultPalette, BLUSH + "colors/rose.color", "an option's own default, aliased to the merged palette");
  assert.equal(definition.blush.enabled, false, "no recipe entry: off");
  assert.equal(definition.blush.weight, 0, "no recipe entry: weight 0");
});

test("a recipe entry turns its option on at its weight; its colours are the default of options without their own", async t =>
{
  const { definition, source } = await configured(t, [ { category: "makeup", path: "makeup/blush/blush_01", colors: "[(0.9, 0.1, 0.1, 1.0), (0.9, 0.1, 0.1, 1.0), (0.9, 0.1, 0.1, 1.0)]", weight: .06 } ]);
  const blush = definition.blush;
  assert.equal(blush.enabled, true);
  assert.equal(blush.option, "blush_01");
  assert.equal(blush.weight, .06);
  const [ first, second ] = blush.GetOptions();
  assert.equal(first.defaultPalette, CjsPaperDollColorizedSource.authored, "no menu palette has the recipe's colours");
  assert.equal(second.defaultPalette, BLUSH + "colors/rose.color");
  assert.ok(first.palettes.some(record => record.path === CjsPaperDollColorizedSource.authored && record.label === "Authored colours"));
  assert.ok(source.IsPrepared("blush_01"), "the recipe's option draws from the first apply");
  assert.deepEqual(first.colorAreas, [ 1, 2 ]);
});

test("recipe colours equal to a menu palette select it instead of adding authored", async t =>
{
  const { definition } = await configured(t, [ { category: "makeup", path: "makeup/blush/blush_01", colors: "[(0.6, 0.0, 0.0, 1.0), (0.6, 0.0, 0.0, 1.0), (0.6, 0.0, 0.0, 1.0)]", weight: 1 } ]);
  assert.equal(definition.blush.GetOptions()[0].defaultPalette, BLUSH + "colors/peach.color");
  assert.ok(!definition.blush.GetOptions()[0].palettes.some(record => record.path === CjsPaperDollColorizedSource.authored));
});
