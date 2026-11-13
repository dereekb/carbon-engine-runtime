import { composeStubResMan } from "../../support/stubResMan.js";

// be.resMan has no source until something configures it; a build that names a
// res path composes one, as dna.test.js does. Import declarations are hoisted,
// so this runs after every import has been evaluated.
composeStubResMan();

import assert from "node:assert/strict";
import { test } from "node:test";
import { EveSOF } from "../../../npm/dist/sof/index.js";

// A modular part (BuildChildValues / BuildChild / AddHull) gets a placement
// container that carries the part transform, and SetupEffects hands that
// container to the child pass as the child owner. Its fields keep `objects`,
// not `effectChildren`, so an effect child must join `objects`, placed in the
// container's space (the part transform applies once, through the container).
// Transform children still join the root's `children` with the part transform.

const PART = [
  5, 0, 0, 0,
  0, 5, 0, 0,
  0, 0, 5, 0,
  10, 20, 30, 1,
];
const PART_TAG = 9;

function createData()
{
  return {
    hull: [
      {
        name: "rifter",
        buildClass: 0,
        geometryResFilePath: "res:/model/rifter.gr2",
        boundingSphere: [1, 2, 3, 4],
        shapeEllipsoidCenter: [5, 6, 7],
        shapeEllipsoidRadius: [8, 9, 10],
        enableDynamicBoundingSphere: false,
        castShadow: true,
        isSkinned: false,
        sof6: false,
        opaqueAreas: [],
      },
      {
        name: "rifter2",
        buildClass: 1,
        isSkinned: true,
        sof6: true,
        opaqueAreas: [],
        childSets: [{
          items: [{ redFilePath: "res:/part/fx.red", translation: [1, 2, 3], rotation: [0, 0, 0, 1] }],
        }],
      },
      {
        name: "legacy",
        buildClass: 0,
        isSkinned: false,
        sof6: false,
        opaqueAreas: [],
        children: [
          { redFilePath: "res:/part/transform.red", translation: [1, 2, 3], rotation: [0, 0, 0, 1] },
          { redFilePath: "res:/part/fx.red", translation: [1, 2, 3], rotation: [0, 0, 0, 1] },
        ],
      },
    ],
    faction: [{ name: "minmatar", visibilityGroupSet: { visibilityGroups: [{ str: "primary" }] } }],
    race: [{ name: "minmatar" }],
    material: [
      { name: "rust", parameters: [] },
      { name: "paint", parameters: [] },
    ],
    pattern: [{ name: "stripes" }],
    layout: [{ name: "antennae" }, { name: "cargo" }],
    generic: {
      materialPrefixes: [{ str: "Mtl1" }, { str: "Mtl2" }],
      variants: [{ name: "transparent", isTransparent: true, hullArea: { shader: "glass" } }],
    },
  };
}

function createSof({ resolver = true } = {})
{
  const sof = new EveSOF();
  assert.equal(sof.dataMgr.SetData(createData()), true);
  if (resolver)
  {
    sof.SetChildResourceResolver(path => path === "res:/part/transform.red"
      ? { _type: "EveTransform", name: "transform", children: [] }
      : { _type: "EveChildContainer", name: "fx", objects: [] });
  }
  return sof;
}

function placementContainer(values)
{
  const container = values.effectChildren.find(child => child._type === "EveChildContainer" && child.partTag === PART_TAG);
  assert.ok(container, "the part's placement container joins the root's effect children");
  return container;
}

test("BuildChildValues adds a SOF6 part's child-set children to its placement container", async () => {
  const sof = createSof();
  const owner = await sof.BuildValuesFromDNA("rifter:minmatar:minmatar");
  const composed = await sof.BuildChildValues(owner, "rifter2:minmatar:minmatar", PART_TAG, PART);

  const container = placementContainer(composed);
  assert.deepEqual(Array.from(container.translation), [10, 20, 30]);
  assert.deepEqual(container.objects.map(object => object._type), ["EveChildMesh", "EveChildContainer"]);
  const fx = container.objects.find(object => object.name === "fx");
  assert.deepEqual(Array.from(fx.translation), [1, 2, 3], "container-local: the container carries the part transform");
  assert.deepEqual(Array.from(fx.rotation), [0, 0, 0, 1]);
  assert.equal(fx.partTag, PART_TAG);
  assert.equal(composed.effectChildren.some(child => child.name === "fx"), false, "no fx on the root");
});

test("a part's deferred child (no resolver) joins its placement container", async () => {
  const sof = createSof({ resolver: false });
  const owner = await sof.BuildValuesFromDNA("rifter:minmatar:minmatar");
  const composed = await sof.BuildChildValues(owner, "rifter2:minmatar:minmatar", PART_TAG, PART);

  const container = placementContainer(composed);
  const ref = container.objects.find(object => object._type === "EveChildRef");
  assert.ok(ref, "the deferred child joins the container's objects");
  assert.equal(ref.resPath, "res:/part/fx.red");
  assert.equal(composed.effectChildren.some(child => child._type === "EveChildRef"), false);
});

test("a legacy part keeps transform children on the root with the part transform", async () => {
  const sof = createSof();
  const owner = await sof.BuildValuesFromDNA("rifter:minmatar:minmatar");
  const composed = await sof.BuildChildValues(owner, "legacy:minmatar:minmatar", PART_TAG, PART);

  const transform = composed.children.find(child => child.name === "transform");
  assert.ok(transform, "the transform child joins the root's children");
  assert.deepEqual(Array.from(transform.translation), [15, 30, 45]);
  const container = placementContainer(composed);
  const fx = container.objects.find(object => object.name === "fx");
  assert.ok(fx, "the effect child joins the container's objects");
  assert.deepEqual(Array.from(fx.translation), [1, 2, 3]);
});

test("standalone builds keep child-set children on the root", async () => {
  const sof = createSof();
  const values = await sof.BuildValuesFromDNA("rifter2:minmatar:minmatar");
  const fx = values.effectChildren.find(child => child.name === "fx");
  assert.ok(fx, "the child-set child joins the root's effect children");
  assert.deepEqual(Array.from(fx.translation), [1, 2, 3]);
});
