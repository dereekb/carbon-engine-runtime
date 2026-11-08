import test from "node:test";
import assert from "node:assert/strict";
import { CjsPaperDollBodyComposer, CjsPaperDollComposition, CjsPaperDollDefinition, PaperDollTarget } from "../../../npm/dist/character/index.js";
import { Tr2Effect } from "../../../npm/dist/trinity/index.js";
import "../../support/frameLoop.js";

/** A compositor recording draws, targets and how each base was made. */
class StubCompositor
{
  draws = [];
  made = 0;
  async Texture(path) { return { path, cutoutX: 0, cutoutY: 0, cutoutWidth: 1, cutoutHeight: 1, width: 2048, height: 2048 }; }
  effect(kind, source) { const effect = new Tr2Effect(); Object.assign(effect, { kind, source }); return effect; }
  async Copy(source) { const effect = this.effect("copy", source); effect.bound = null; effect.GetResourceByName = () => ({ SetResource: value => { effect.bound = value; } }); return effect; }
  async Simple(source) { return this.effect("simple", source); }
  TargetTexture(width, height, mips) { const index = this.made++; return { target: { index, width, height, mips }, resource: { index } }; }
  Draw(target, width, height, value, region, clear = false, writeRGBA = clear) { this.draws.push({ target: target.index, width, height, value, clear, writeRGBA }); }
  Finish() {}
}

async function prepared()
{
  const build = { report: {}, CheckActive() {}, Ready: value => value };
  const composition = new CjsPaperDollComposition(null, build);
  const compositor = composition.compositor = new StubCompositor();
  // The skin target's body output, which the body diffuse copies.
  composition.AddOutput({ target: PaperDollTarget.SKIN, region: "body", channel: "DiffuseMap", width: 2048, height: 2048, base: () => null });
  // A garment answering the body diffuse with its detail and the cut mask with its masks.
  const garment = { DiffuseMap: { effect: "detail", region: Float32Array.of(0, .5, .5, .5) }, CutMaskMap: [ { effect: "mask", region: Float32Array.of(0, .5, .25, .25) } ] };
  composition.SetSource("topMiddle", { GetLayers: (value, region, channel) => region !== "body" || !value.option ? []
    : channel === "DiffuseMap" ? [ garment.DiffuseMap ] : channel === "CutMaskMap" ? garment.CutMaskMap : [] });
  const bound = { diffuse: [], cutMask: [] };
  const body = new CjsPaperDollBodyComposer(composition, build);
  await body.Prepare(new CjsPaperDollDefinition(), "res:/graphics/character/female/basebody/body_d.png",
    [ resource => bound.diffuse.push(resource.index) ], [ resource => bound.cutMask.push(resource.index) ]);
  return { composition, compositor, body, bound };
}

test("the body target is the foundation body diffuse's size: a diffuse over the skin's body output, and a white cut mask", async () =>
{
  const { composition, compositor, body } = await prepared();
  assert.deepEqual([ body.width, body.height ], [ 2048, 2048 ]);
  const [ diffuse, cutMask ] = composition._rows.filter(row => row.target === PaperDollTarget.BODY);
  assert.deepEqual([ diffuse.channel, diffuse.mips, cutMask.channel, cutMask.mips, cutMask.list ], [ "DiffuseMap", true, "CutMaskMap", true, "order" ]);
  // The first draw is the definition's state: each base into the cleared target, writing RGBA.
  const bases = compositor.draws.filter(draw => draw.clear);
  assert.deepEqual(bases.map(draw => [ draw.value.kind, draw.writeRGBA ]), [ [ "copy", true ], [ "simple", true ] ]);
  assert.equal(bases[0].value.bound, composition.GetOutput(PaperDollTarget.SKIN, "body", "DiffuseMap"));
  assert.equal(bases[1].value.source.path, "dynamic:/color/1,1,1,1");
});

test("a part the capture hands over draws its diffuse and cuts the mask; one it does not hand over draws nothing", async () =>
{
  const { compositor, body, bound } = await prepared();
  compositor.draws.length = 0;
  body.Apply({ topMiddle: { option: "shirtaf01" }, lists: { order: [ "topMiddle" ] } });
  assert.deepEqual(compositor.draws.filter(draw => !draw.clear).map(draw => draw.value), [ "detail", "mask" ]);
  assert.equal(bound.diffuse.length, 1);
  assert.equal(bound.cutMask.length, 1);
  compositor.draws.length = 0;
  // Suppressed: not in the ready list.
  body.Apply({ topMiddle: { option: "shirtaf01" }, lists: { order: [] } });
  assert.deepEqual(compositor.draws.filter(draw => !draw.clear), []);
});
