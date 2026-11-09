import test from "node:test";
import assert from "node:assert/strict";
import { CjsPaperDollColorizedSource, CjsPaperDollDefinition } from "../../../npm/dist/character/index.js";
import { Tr2Effect } from "../../../npm/dist/trinity/index.js";
import { installPartsLibrary } from "../../support/partsLibrary.js";

const ROOT = "res:/graphics/character/female/paperdoll/";
const BLUSH = ROOT + "makeup/blush/";
const FILES = [
  BLUSH + "blush_01/types/blush_01.type", BLUSH + "blush_01/colorize_head_l.png", BLUSH + "blush_01/colorize_head_z.png",
  BLUSH + "blush_02/types/blush_02.type", BLUSH + "blush_02/colorize_head_l.png", BLUSH + "blush_02/colorize_head_z.png", BLUSH + "blush_02/default.color",
  BLUSH + "colors/rose.color", BLUSH + "colors/peach.color"
];
/** Each palette's colours: rose and blush_02's default are the same colours, so they merge. */
const PALETTES = { "colors/rose.color": .3, "colors/peach.color": .6, "blush_02/default.color": .3 };

function services(t)
{
  const overrides = {
    FetchPalette: async (path, { specular = false } = {}) => ({ colors: [ 0, 1, 2 ].map(() => Float32Array.of(PALETTES[path.slice(BLUSH.length)], 0, 0, 1)), specularColors: specular ? [ 0, 1, 2 ].map(() => Float32Array.of(1, 1, 1, 1)) : null, pattern: null })
  };
  installPartsLibrary(t, ROOT, FILES, { overrides });
}

class StubCompositor
{
  async Texture(path) { return { path, cutoutX: 0, cutoutY: 0, cutoutWidth: .5, cutoutHeight: .25, width: 512, height: 256 }; }
  async Colorized(detail, region, zone) { const effect = new Tr2Effect(); Object.assign(effect, { detail, zone }); return effect; }
  async ColorAreas() { return [ 1, 2 ]; }
}

async function configured(t)
{
  services(t);
  const build = { content: { root: ROOT, sex: "female" }, CheckActive() {}, Ready: value => value };
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
  assert.equal(first.defaultPalette, undefined, "no own default: none");
  assert.equal(second.defaultPalette, BLUSH + "blush_02/default.color");
  assert.equal(definition.blush.enabled, false, "off until the factory sets it");
  assert.equal(definition.blush.weight, 0, "weight 0 until the factory sets it");
});

