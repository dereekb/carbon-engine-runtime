import test from "node:test";
import assert from "node:assert/strict";
import { mat4 } from "../../npm/dist/global/math/mat4.js";
import { EveSpaceObject2, EveSpaceObjectDecal, EveUpdateContext, Tr2GrannyAnimation, Tr2Lod, Tr2Mesh, TriFrustum } from "../../npm/dist/trinity/index.js";
import { EveChildMesh } from "../../npm/dist/trinity/eve/child/EveChildMesh.js";

// Carbon's decal data flow is an UPDATE PASS, not a values transport: the owner
// fills one ParentData for the pass and each decal copies the struct.
// EveSpaceObject2.cpp:1694-1706 (hull), EveChildMesh.cpp:1015 + 450 (child).

function decalSpy()
{
  const seen = [];
  const calls = [];
  return {
    seen,
    calls,
    boneCalls: 0,
    SetBoneMatrix(bones, boneCount) { this.boneCalls += 1; calls.push({ method: "SetBoneMatrix", bones, boneCount }); },
    UpdateVisibility(_updateContext, parentData) { seen.push(parentData); calls.push({ method: "UpdateVisibility" }); return true; }
  };
}

/** A child mesh with unit bounds and no geometry, updated once under a parent; everything else is the real class. */
function updatedChild(configure = () => {})
{
  const child = new EveChildMesh();
  child.mesh = new (class extends Tr2Mesh
  {
    GetBounds() { return { min: [ -1, -1, -1 ], max: [ 1, 1, 1 ] }; }
    GetAreas() { return []; }
  })();
  configure(child);

  child.UpdateAsyncronous(new EveUpdateContext(), {
    localToWorldTransform: mat4.create(),
    spaceObjectParent: new EveSpaceObject2(),
    activationStrength: 1,
    boneCount: 0,
    bones: null
  });
  return child;
}

/** A real animation updater pinned to a two-bone palette whose bone 1 has moved; `initialized` is its IsInitialized answer. */
function animationUpdater(initialized)
{
  const palette = new Float32Array(24);
  palette.set([ 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0 ], 0);
  palette.set([ 1, 0, 0, 0, 0, 1, 0, -450, 0, 0, 1, 0 ], 12);

  const updater = new (class extends Tr2GrannyAnimation
  {
    IsInitialized() { return initialized; }
    HasMeshBinding() { return true; }
    GetMeshBoneCount() { return 2; }
    GetMeshBoneMatrixList() { return palette; }
  })();
  return { updater, palette };
}

function visibleHull()
{
  const object = new EveSpaceObject2();
  object.mesh = {
    GetMeshIndex: () => 0,
    GetGeometryResource: () => ({ IsGood: () => true, GetLodIndexForScreenSize: () => 0 }),
    GetBoundingBox(min, max)
    {
      min.set([ -1, -1, -1 ]);
      max.set([ 1, 1, 1 ]);
      return true;
    },
    IsLoading: () => false,
    UseWithScreenSize() {}
  };
  object.translationCurve = { GetValueDotAt__Ticks(_time, out) { return out; }, Update__Ticks(_time, out) { out.set([ 10, 20, 30 ]); } };
  object.SetBoundingSphereInformation(new Float32Array([ 0, 0, 0, 5 ]));
  object.UpdateWorldTransform(1);
  object.UpdateWorldBounds();
  return object;
}

/** A real update context whose real frustum answers visible (or not) at fixed pixel sizes. */
function updateContext(visible = true)
{
  const frustum = new (class extends TriFrustum
  {
    IsSphereVisible() { return visible; }
    IsBoxVisible() { return visible; }
    GetPixelSizeAccross() { return 80; }
    GetPixelSizeAccrossEst() { return 75; }
  })();
  const context = new EveUpdateContext();
  context.SetFrustum(frustum);
  // The context copies the frustum by value (ruling 16, EveUpdateContext.h:182-185),
  // which slices a stub subclass; keep the stub's pinned answers on its own copy.
  Object.setPrototypeOf(context.GetFrustum(), Object.getPrototypeOf(frustum));
  context.SetVisibilityThreshold(1);
  context.SetLowDetailThreshold(20);
  context.SetMediumDetailThreshold(60);
  context.SetLodFactor(1);
  return context;
}
const visibleContext = updateContext();

test("a visible hull hands its decals one ParentData built for the pass", () =>
{
  const object = visibleHull();
  object.spaceObjectShipData.set([ 0.1, 0.2, 0.3, 0.4 ]);
  const decal = decalSpy();
  Array.prototype.push.call(object.decals, decal);

  assert.equal(object.UpdateVisibility(visibleContext), true);
  assert.equal(decal.seen.length, 1, "the decal pass ran");

  const parentData = decal.seen[0];
  assert.notEqual(parentData, object, "a ParentData record, not the hull");
  assert.deepEqual(Array.from(parentData.transform), Array.from(object.worldTransform));
  assert.deepEqual(Array.from(parentData.shipData), Array.from(object.spaceObjectShipData));
  assert.equal(decal.boneCalls, 0, "no animation updater, so no bone palette");

  object.UpdateVisibility(visibleContext);
  assert.equal(decal.seen[1], parentData, "the same record is refreshed, not reallocated");
});

test("a hull whose mesh is not visible runs no decal pass", () =>
{
  const object = visibleHull();
  const decal = decalSpy();
  Array.prototype.push.call(object.decals, decal);

  object.UpdateVisibility(updateContext(false));
  assert.equal(decal.seen.length, 0);
});

test("a child mesh hands its decals its own ParentData, placed by the child", () =>
{
  const parent = new EveSpaceObject2();
  parent.spaceObjectShipData.set([ 0.5, 0.6, 0.7, 0.8 ]);

  const child = new EveChildMesh();
  // A real Tr2Mesh with unit bounds and no geometry; everything else is the real class.
  child.mesh = new (class extends Tr2Mesh
  {
    GetBounds() { return { min: [ -1, -1, -1 ], max: [ 1, 1, 1 ] }; }
    GetAreas() { return []; }
  })();
  const decal = decalSpy();
  Array.prototype.push.call(child.decals, decal);

  child.UpdateAsyncronous(new EveUpdateContext(), {
    localToWorldTransform: mat4.fromTranslation(mat4.create(), [ 7, 8, 9 ]),
    spaceObjectParent: parent,
    activationStrength: 1,
    boneCount: 0,
    bones: null
  });
  assert.equal(child.UpdateVisibility(visibleContext, null, Tr2Lod.TR2_LOD_HIGH), true);
  assert.equal(decal.seen.length, 1, "the child's decal pass ran");

  const parentData = decal.seen[0];
  assert.notEqual(parentData, child, "a ParentData record, not the child mesh");
  assert.deepEqual(Array.from(parentData.transform), Array.from(child.worldTransform),
    "cpp:1044 - the decal is placed by the child's world transform");
  assert.deepEqual(Array.from(parentData.transform.slice(12, 15)), [ 7, 8, 9 ]);
  assert.deepEqual(Array.from(parentData.shipData), [ 0.5, 0.6, 0.7, 0.8 ].map(Math.fround),
    "cpp:1015 - the rest comes from the space object parent");
});

// EveChildMesh.cpp:441-452: an initialized animation updater's bone palette goes
// to each decal before the decal's own UpdateVisibility, so a decal on an
// animated part follows its bone instead of staying where the part rested.
test("an animated child mesh gives each decal its bone palette before the decal's visibility", () =>
{
  const { updater, palette } = animationUpdater(true);
  const child = updatedChild(value => { value.animationUpdater = updater; });
  const spy = decalSpy();
  Array.prototype.push.call(child.decals, spy);

  // A real decal parented to the moved bone, beside the spy.
  const decal = new EveSpaceObjectDecal();
  decal.decalEffect = {};
  decal.parentBoneIndex = 1;
  Array.prototype.push.call(child.decals, decal);

  assert.equal(child.UpdateVisibility(visibleContext, null, Tr2Lod.TR2_LOD_HIGH), true);

  assert.deepEqual(spy.calls.map(call => call.method), [ "SetBoneMatrix", "UpdateVisibility" ], "cpp:447-451 - the bones come first");
  assert.equal(spy.calls[0].bones, palette, "cpp:447 - GetBoneTransforms' palette, borrowed");
  assert.equal(spy.calls[0].boneCount, 2);
  assert.deepEqual(Array.from(decal._parentBoneMatrix.slice(12, 15)), [ 0, -450, 0 ], "the decal rides bone 1");
});

test("a child mesh whose animation updater is not initialized gives its decals no bone palette", () =>
{
  const { updater } = animationUpdater(false);
  const child = updatedChild(value => { value.animationUpdater = updater; });
  const spy = decalSpy();
  Array.prototype.push.call(child.decals, spy);

  assert.equal(child.UpdateVisibility(visibleContext, null, Tr2Lod.TR2_LOD_HIGH), true);
  assert.deepEqual(spy.calls.map(call => call.method), [ "UpdateVisibility" ], "cpp:445 - no initialized updater, no SetBoneMatrix");
});

// EveChildMesh.cpp:1081-1089: the attachments' lights take the mesh's bone palette
// with the world transform, so a light on a bone follows it.
test("a child mesh passes its bone palette to its attachments' lights", () =>
{
  const { updater, palette } = animationUpdater(true);
  const calls = [];
  const attachment = { UpdateLights(...args) { calls.push(args); } };
  const child = updatedChild(value =>
  {
    value.animationUpdater = updater;
    Array.prototype.push.call(value.attachments, attachment);
  });

  assert.equal(calls.length, 1, "cpp:1084-1088 - one UpdateLights per attachment");
  const [ transform, bones, boneCount, activationStrength, boosterGain ] = calls[0];
  assert.equal(transform, child.worldTransform);
  assert.equal(bones, palette, "cpp:1083 - GetBoneTransforms' palette, borrowed");
  assert.equal(boneCount, 2);
  assert.equal(activationStrength, 1);
  assert.equal(boosterGain, 0, "cpp:1087 - the child has no booster gain of its own");
});
