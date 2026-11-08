import test from "node:test";
import assert from "node:assert/strict";
import { CjsPaperDollDefinition, CjsPaperDollInstance, PaperDollTarget } from "../../../npm/dist/character/index.js";

/** A definition wearing the given options: { part: { id, path, occludes } }, each on. */
function wearing(options)
{
  const definition = new CjsPaperDollDefinition();
  for (const [ part, option ] of Object.entries(options))
  {
    definition[part].Configure([ { id: option.id, path: option.path, occludes: option.occludes } ], new Map(), { option: option.id });
    definition[part].enabled = true;
  }
  return definition;
}

test("a worn part another's occludesModifiers names is suppressed; it leaves the body and surface lists only", () =>
{
  const definition = wearing({
    outer: { id: "coat", path: "outer/coat", occludes: [ "topmiddle", "hair" ] },
    topMiddle: { id: "shirt", path: "topmiddle/shirt", occludes: [] },
    hair: { id: "short", path: "hair/short", occludes: [] }
  });
  const suppression = CjsPaperDollInstance.suppress(definition);
  assert.deepEqual(suppression.suppressed, [ "hair", "topMiddle" ]);
  const body = CjsPaperDollInstance.ready(definition, PaperDollTarget.BODY);
  assert.ok(!body.lists.order.includes("topMiddle") && body.lists.order.includes("outer"));
  assert.deepEqual(body.order, body.lists.order, "the capture's order is the ready list");
  assert.ok("topMiddle" in body, "a suppressed part's settings stay in the capture");
  assert.ok(!CjsPaperDollInstance.ready(definition, PaperDollTarget.SURFACE).lists.order.includes("topMiddle"));
  // Hair is not baked into the body: suppressed, it still bakes (today's hair does not skip).
  assert.ok(CjsPaperDollInstance.ready(definition, PaperDollTarget.HEAD).lists.order.includes("hair"));
  assert.ok(CjsPaperDollInstance.ready(definition, PaperDollTarget.SURFACE).lists.order.includes("hair"));
});

test("the walk runs from the roots, keeps a cycle active, and leaves decal parts out", () =>
{
  const chain = wearing({
    outer: { id: "a", path: "outer/a", occludes: [ "topouter" ] },
    topOuter: { id: "b", path: "topouter/b", occludes: [ "topmiddle" ] },
    topMiddle: { id: "c", path: "topmiddle/c", occludes: [] }
  });
  assert.deepEqual(CjsPaperDollInstance.suppress(chain).suppressed, [ "topOuter" ], "a suppressed part's own edges stop applying");
  const cycle = wearing({
    outer: { id: "a", path: "outer/a", occludes: [ "topouter" ] },
    topOuter: { id: "b", path: "topouter/b", occludes: [ "outer" ] }
  });
  assert.deepEqual(CjsPaperDollInstance.suppress(cycle), { suppressed: [], cyclic: [ "topOuter", "outer" ].sort((x, y) => cycle.constructor.parts.indexOf(x) - cycle.constructor.parts.indexOf(y)) });
  // A face augmentation occluding the beard is drawn over it (GetLayerOrder), not suppressed.
  const paint = wearing({ augmentations: { id: "p", path: "makeup/augmentations/p", occludes: [ "beard" ] }, beard: { id: "b", path: "beard/b", occludes: [] } });
  assert.deepEqual(CjsPaperDollInstance.suppress(paint).suppressed, []);
  const head = CjsPaperDollInstance.ready(paint, PaperDollTarget.HEAD).lists.order;
  assert.ok(head.indexOf("augmentations") > head.indexOf("beard"));
});

test("the head's brow list is the parts after the eyebrows", () =>
{
  const definition = new CjsPaperDollDefinition();
  const { lists } = CjsPaperDollInstance.ready(definition, PaperDollTarget.HEAD);
  assert.deepEqual(lists.brow, lists.order.slice(lists.order.indexOf("eyebrows") + 1));
  assert.ok(lists.brow.length > 0 && !lists.brow.includes("eyebrows"));
  assert.equal(CjsPaperDollInstance.ready(definition, PaperDollTarget.BODY).lists.brow, undefined, "only the head has a brow list");
});

test("an unresolved option is not walked until it resolves; the beard is kept out of the walk", async () =>
{
  const definition = new CjsPaperDollDefinition();
  let release;
  const resolution = new Promise(resolve => { release = resolve; });
  definition.outer.Configure([ { id: "coat", path: "outer/coat" } ], new Map(), { option: "coat", resolve: () => resolution });
  definition.outer.enabled = true;
  definition.topMiddle.Configure([ { id: "shirt", path: "topmiddle/shirt", occludes: [] } ], new Map(), { option: "shirt" });
  definition.topMiddle.enabled = true;
  definition.beard.Configure([ { id: "b", path: "beard/b", occludes: [] } ], new Map(), { option: "b" });
  definition.beard.enabled = true;
  definition.mask.Configure([ { id: "m", path: "accessories/masks/m", occludes: [ "beard" ] } ], new Map(), { option: "m" });
  definition.mask.enabled = true;
  assert.deepEqual(CjsPaperDollInstance.suppress(definition).suppressed, [], "the unresolved coat is not a node; the beard is not walked");
  const resolved = definition.outer.ResolveOption("coat");
  release({ occludes: [ "topmiddle" ], colorAreas: [] });
  await resolved;
  assert.deepEqual(CjsPaperDollInstance.suppress(definition).suppressed, [ "topMiddle" ]);
});
