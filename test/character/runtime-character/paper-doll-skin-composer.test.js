import test from "node:test";
import assert from "node:assert/strict";
import { CjsPaperDollDefinition, CjsPaperDollSkinComposer } from "../../../npm/dist/character/index.js";
import { BluePaths, BlueResFileSystemRemote, RemoteFileCache } from "../../../npm/dist/blue/index.js";
import { installBlueServices } from "../../../npm/dist/blue/blue.js";
import "../../support/frameLoop.js";

const ROOT = "res:/graphics/character/female/paperdoll/skintone/basic/";
const FILES = [ "deteis_default.color", "deteis_light.color", "default.color", "colorize_head_l.png", "colorize_head_z.png",
  "colorize_body_l_512.png", "colorize_body_l.png", "colorize_body_z.png", "deteis.base", "nested/other.color", "skin.red" ].map(name => ROOT + name);
const PALETTE = [ [ .1, .2, .3, 1 ], [ .4, .5, .6, 1 ], [ .7, .8, .9, 1 ] ];

/** A paths service over FILES (Carbon's own BluePaths over a remote index), and a character library of one palette. */
function services(t)
{
  const cache = new RemoteFileCache();
  cache.AddFileIndex(FILES.map((path, index) => `${path.replace(/\.red$/u, ".black")},synthetic/${index},checksum,1`).join("\n"));
  const paths = new BluePaths();
  paths.RegisterFileSystem(new BlueResFileSystemRemote(cache));
  const fetched = [];
  const characterLibrary = { FetchPalette: async (path, options) => { fetched.push([ path, options ]); return { colors: PALETTE }; } };
  const previous = installBlueServices({ paths, characterLibrary }, false);
  t.after(() => installBlueServices(previous, previous.running));
  return { paths, fetched };
}

/** A compositor recording what the skin asks of it. */
class StubCompositor
{
  draws = [];
  made = 0;
  destructed = false;
  async Texture(path)
  {
    // An alpha of 51/255 at every sampled texel of a 32x32 RGBA bitmap.
    const data = new Uint8Array(32 * 32 * 4).fill(51);
    return { path, cutoutX: 0, cutoutY: 0, cutoutWidth: 1, cutoutHeight: .5, width: 32, height: 32, loadedBitmap: { GetMipRawData: () => data, GetPitch: () => 128 } };
  }
  async ColorAreas(detail) { return detail.path.includes("head") ? [ 1, 2 ] : [ 2, 3 ]; }
  async Copy(source) { return { source, SetParameter(name, value) { this[name] = value; } }; }
  Colorized(detail, region, zone, zoneRegion, colors) { return { detail, colors: colors.map(color => Array.from(color)), SetParameter__Vector4(name, value) { this[name] = Array.from(value); } }; }
  TargetTexture(width, height) { const index = this.made++; return { target: { index, width, height }, resource: { index } }; }
  Draw(target, width, height, value, region, clear = false) { this.draws.push({ target: target.index, width, height, value, region: Array.from(region), clear }); }
  Destruct() { this.destructed = true; }
}

function definition()
{
  const skin = { palette: ROOT + "deteis_light.color", enabled: true, configured: null, GetColors: () => PALETTE, Configure(...args) { this.configured = args; } };
  return { skin };
}

const foundation = id => ({ bindings: { head: { DiffuseMap: `res:/${id}_head_d.dds` }, body: { DiffuseMap: `res:/${id}_body_d.dds` } } });

async function prepared(t)
{
  const { fetched } = services(t);
  const build = { content: { root: "res:/graphics/character/female/paperdoll/" }, report: {}, CheckActive() {}, Ready: value => value };
  const skin = new CjsPaperDollSkinComposer(null, build);
  const compositor = skin.compositor = new StubCompositor();
  const doll = definition(), notes = [], body = [ { SetResource(value) { this.bound = value; } } ];
  const foundations = new Map([ [ "a", foundation("a") ] ]);
  await skin.Prepare(doll, foundation("a"), foundations, body, message => notes.push(message));
  return { skin, compositor, doll, notes, body, build, foundations, fetched };
}

test("listFiles lists a directory from the index, each stored .black under its own name, sorted (Graphene's ListResourceFiles moved)", t =>
{
  const { paths } = services(t);
  const listed = CjsPaperDollDefinition.listFiles(ROOT);
  assert.ok(listed.includes(ROOT + "skin.black") && !listed.includes(ROOT + "skin.red"));
  assert.deepEqual(listed, [ ...listed ].sort());
  assert.deepEqual(CjsPaperDollDefinition.listFiles(ROOT, paths), listed, "an explicit paths service lists the same");
});

test("Prepare configures the skin from the folder's palettes and the regions' colour areas, and draws the initial skin", async t =>
{
  const { compositor, doll, build, fetched } = await prepared(t);
  const [ options, , values ] = doll.skin.configured;
  assert.deepEqual(values, { option: "basic" });
  assert.equal(options[0].defaultPalette, ROOT + "deteis_default.color");
  assert.deepEqual(options[0].colorAreas, [ 1, 2, 3 ], "the union of head and body areas");
  assert.deepEqual(options[0].palettes.map(value => value.label), [ "Neutral", "Deteis · Default", "Deteis · Light" ], "nested palettes are left out");
  assert.deepEqual(fetched, [ [ ROOT + "deteis_default.color", { pattern: "reject" } ] ], "only the initial palette is read");
  assert.equal(build.report.skin.regions.body.detail, ROOT + "colorize_body_l.png", "the setting's tier, falling back to the unsuffixed map");
  // Head then body: the base copy cleared into the target, then the colourised layer over the detail's cutout.
  assert.deepEqual(compositor.draws.map(draw => [ draw.width, draw.height, draw.clear ]), [ [ 2048, 1024, true ], [ 2048, 1024, false ], [ 2048, 2048, true ], [ 2048, 2048, false ] ]);
  assert.deepEqual(compositor.draws[1].region, [ 0, 0, 1, .5 ]);
  assert.equal(compositor.draws[0].value.AlphaMultiplier, 51 / 255, "the base takes the detail's median alpha under a skin option");
});

test("Apply draws into the other target each time, binds the body base and reports the definition's skin", async t =>
{
  const { skin, compositor, body, build, notes } = await prepared(t);
  const first = skin.bodyTexture;
  skin.Apply({ skin: { option: "basic", colors: PALETTE } });
  assert.notEqual(skin.bodyTexture, first);
  assert.equal(body[0].bound, skin.bodyTexture);
  assert.deepEqual(compositor.draws.at(-1).value.Color1, PALETTE[0]);
  skin.Apply({ skin: { option: "", colors: PALETTE } });
  assert.equal(skin.bodyTexture, first, "two targets, alternating");
  assert.equal(compositor.draws.at(-1).clear, true, "no option: the base only");
  assert.equal(compositor.draws.at(-1).value.AlphaMultiplier, 1);
  assert.equal(build.report.skin.updates, 2);
  assert.equal(build.report.skin.selected, ROOT + "deteis_light.color");
  assert.deepEqual(notes, [ "skin palette applied", "skin palette applied" ]);
});

test("a foundation is copied once, selected for the next apply, and an unprepared one is refused; Destruct releases the compositor", async t =>
{
  const { skin, compositor, build, foundations } = await prepared(t);
  foundations.set("b", foundation("b"));
  await skin.PrepareFoundation("b", foundation("b"));
  await skin.PrepareFoundation("b", foundation("b"));
  skin.SelectFoundation("b");
  assert.equal(build.report.skin.foundation, "b");
  assert.equal(build.report.skin.regions.head.base, "res:/b_head_d.dds");
  skin.Apply({ skin: { option: "basic", colors: PALETTE } });
  assert.equal(compositor.draws.at(-2).value.source.path, "res:/b_body_d.dds");
  assert.throws(() => skin.SelectFoundation("c"), /Unprepared skin foundation c/);
  skin.Destruct();
  assert.equal(compositor.destructed, true);
});
