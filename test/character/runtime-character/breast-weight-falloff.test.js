import assert from "node:assert/strict";
import test from "node:test";
import { CjsBreastWeightFalloff, CjsPaperDollDefinition } from "../../../npm/dist/character/index.js";

// A Granny mesh in the female torso's layout (topinner/torso_nude.gr2): Real32
// positions, four NormalUInt8 weights, four UInt8 indices into the mesh's
// bone bindings. Each vertex is [ position, [ [ binding, weight ], ... ] ].
function grannyMesh(bindings, vertices)
{
  const stride = 20;
  const bytes = new Uint8Array(stride * vertices.length);
  const view = new DataView(bytes.buffer);
  vertices.forEach(([ position, influences ], vertex) =>
  {
    const base = vertex * stride;
    position.forEach((value, axis) => view.setFloat32(base + axis * 4, value, true));
    influences.forEach(([ binding, weight ], slot) =>
    {
      view.setUint8(base + 12 + slot, weight);
      view.setUint8(base + 16 + slot, bindings.indexOf(binding));
    });
  });
  return {
    BoneBindings: bindings.map(name => ({ BoneName: name })),
    PrimaryVertexData: { Vertices: { bytes, stride, count: vertices.length, type: [
      { name: "Position", type: 10, arrayWidth: 3 }, { name: "BoneWeights", type: 14, arrayWidth: 4 }, { name: "BoneIndices", type: 12, arrayWidth: 4 } ] } }
  };
}

function influences(mesh, vertex)
{
  const { bytes, stride } = mesh.PrimaryVertexData.Vertices;
  const names = mesh.BoneBindings.map(binding => binding.BoneName);
  const out = {};
  for (let slot = 0; slot < 4; slot++)
  {
    const weight = bytes[vertex * stride + 12 + slot];
    if (weight) out[names[bytes[vertex * stride + 16 + slot]]] = (out[names[bytes[vertex * stride + 16 + slot]]] ?? 0) + weight;
  }
  return out;
}

/** A loaded geometry holding the meshes, with one LOD per mesh already on the GPU. */
function geometryOf(meshes)
{
  const uploads = [];
  const lods = meshes.map((_, index) => ({ grannyMeshIndex: index, allocationsValid: true, vertexAllocation: { Update: bytes => uploads.push([ index, bytes.slice() ]) } }));
  return {
    uploads,
    IsGood: () => true, IsUsingCMF: () => false, GetGrannyInfo: () => ({ Meshes: meshes }),
    GetMeshCount: () => meshes.length, GetMeshLod__LodIndex: (mesh, lod) => (lod === 0 ? lods[mesh] : null)
  };
}

const CENTRE = [ 0.08, 1.29, 0.11 ];

/** The vertex sets of Granny meshes, as the pass reads them. */
function setsOf(meshes)
{
  return CjsBreastWeightFalloff.vertexSets(geometryOf(meshes));
}

/** A loaded CMF geometry in a character's layout: Float32 positions and weights, UInt16 indices, one LOD on the GPU. */
function cmfGeometryOf(bindings, vertices)
{
  const vertex = { position: [], blendWeight: [], blendIndice: [] };
  for (const [ position, influences ] of vertices)
  {
    vertex.position.push(...position);
    for (let slot = 0; slot < 4; slot++)
    {
      vertex.blendWeight.push(influences[slot] ? influences[slot][1] : 0);
      vertex.blendIndice.push(influences[slot] ? bindings.indexOf(influences[slot][0]) : 0);
    }
  }
  const mesh = {
    decl: [ { usage: "Position", usageIndex: 0, type: "Float32", elementCount: 3, offset: 0 },
      { usage: "BoneIndices", usageIndex: 0, type: "UInt16", elementCount: 4, offset: 12 },
      { usage: "BoneWeights", usageIndex: 0, type: "Float32", elementCount: 4, offset: 20 } ],
    boneBindings: bindings.map(name => ({ name })), vertex, lods: [ {} ]
  };
  const uploads = [];
  const lod = { originalLodIndex: 0, allocationsValid: true, vertexAllocation: { Update: bytes => uploads.push(bytes.slice()) } };
  return {
    mesh, uploads,
    IsGood: () => true, IsUsingCMF: () => true, GetCMFData: () => ({ meshes: [ mesh ] }),
    GetMeshCount: () => 1, GetMeshLod__LodIndex: (meshIndex, lodIndex) => (lodIndex === 0 ? lod : null)
  };
}

test("the falloff is off by default", () =>
{
  assert.equal(CjsPaperDollDefinition.characterBreastWeightFalloff, false);
});

test("each breast centre is its joint's weighted centroid, the weight squared", () =>
{
  const mesh = grannyMesh([ "LeftLung", "Spine3", "RightLung" ], [
    [ [ 0.1, 1.3, 0.1 ], [ [ "LeftLung", 255 ] ] ],
    [ [ 0.0, 1.5, 0.0 ], [ [ "LeftLung", 51 ], [ "Spine3", 204 ] ] ],
    [ [ -0.1, 1.3, 0.1 ], [ [ "RightLung", 255 ] ] ]
  ]);
  const centres = CjsBreastWeightFalloff.centres(setsOf([ mesh ]));
  // A 0.2 weight counts 0.04 against the full vertex's 1.
  const expected = [ 0.1 / 1.04, (1.3 + 1.5 * 0.04) / 1.04, 0.1 / 1.04 ];
  centres.get("LeftLung").forEach((value, axis) => assert.ok(Math.abs(value - expected[axis]) < 1e-6));
  assert.deepEqual([ ...centres.get("RightLung") ].map(value => +value.toFixed(5)), [ -0.1, 1.3, 0.1 ]);
});

test("lung weight is kept near the centre and moves onto Spine3 away from it, each vertex still summing to 255", () =>
{
  const mesh = grannyMesh([ "LeftLung", "Spine3", "LeftShoulder" ], [
    [ CENTRE, [ [ "LeftLung", 102 ], [ "Spine3", 153 ] ] ],
    // The collarbone, 0.17 m above the centre.
    [ [ 0.08, 1.46, 0.11 ], [ [ "LeftLung", 51 ], [ "Spine3", 153 ], [ "LeftShoulder", 51 ] ] ],
    // Halfway through the falloff, with no Spine3 slot: the free slot takes Spine3.
    [ [ 0.08, 1.29 + 0.085, 0.11 ], [ [ "LeftLung", 200 ], [ "LeftShoulder", 55 ] ] ]
  ]);
  assert.equal(CjsBreastWeightFalloff.reweight(setsOf([ mesh ])[0], new Map([ [ "LeftLung", Float64Array.from(CENTRE) ] ])), true);

  assert.deepEqual(influences(mesh, 0), { LeftLung: 102, Spine3: 153 });
  assert.deepEqual(influences(mesh, 1), { Spine3: 204, LeftShoulder: 51 });
  assert.deepEqual(influences(mesh, 2), { LeftLung: 100, LeftShoulder: 55, Spine3: 100 }, "smoothstep at the middle keeps half");
});

test("a mesh without Spine3 gives the lost weight to its largest other influence", () =>
{
  const mesh = grannyMesh([ "LeftLung", "Spine2", "LeftShoulder" ], [
    [ [ 0.08, 1.46, 0.11 ], [ [ "LeftLung", 55 ], [ "Spine2", 150 ], [ "LeftShoulder", 50 ] ] ]
  ]);
  CjsBreastWeightFalloff.reweight(setsOf([ mesh ])[0], new Map([ [ "LeftLung", Float64Array.from(CENTRE) ] ]));
  assert.deepEqual(influences(mesh, 0), { Spine2: 205, LeftShoulder: 50 });
});

test("turning the pass on and off uploads the drawn LODs and restores the file's bytes exactly", () =>
{
  const body = grannyMesh([ "LeftLung", "Spine3" ], [
    [ CENTRE, [ [ "LeftLung", 255 ] ] ],
    [ [ 0.08, 1.46, 0.11 ], [ [ "LeftLung", 51 ], [ "Spine3", 204 ] ] ]
  ]);
  const arm = grannyMesh([ "LeftArm" ], [ [ [ 0.3, 1.3, 0 ], [ [ "LeftArm", 255 ] ] ] ]);
  const original = body.PrimaryVertexData.Vertices.bytes.slice();
  const geometry = geometryOf([ body, arm ]);

  assert.equal(CjsBreastWeightFalloff.applyToGeometry(geometry, true), 1, "only the lung-bound mesh changes");
  assert.deepEqual(influences(body, 1), { Spine3: 255 });
  assert.deepEqual(geometry.uploads.map(([ index ]) => index), [ 0 ]);
  assert.equal(CjsBreastWeightFalloff.applyToGeometry(geometry, true), 0, "applying again changes nothing");

  assert.equal(CjsBreastWeightFalloff.applyToGeometry(geometry, false), 1);
  assert.deepEqual(body.PrimaryVertexData.Vertices.bytes, original);
  assert.deepEqual(geometry.uploads[1][1], original, "the restored bytes are uploaded");
});

test("objects share a geometry once, and a mesh without geometry is skipped", () =>
{
  // Three vertices on the breast put its centre 0.13 m below the fourth, the collarbone, which loses its weight.
  const body = grannyMesh([ "LeftLung", "Spine3" ], [
    [ CENTRE, [ [ "LeftLung", 255 ] ] ], [ CENTRE, [ [ "LeftLung", 255 ] ] ], [ CENTRE, [ [ "LeftLung", 255 ] ] ],
    [ [ 0.08, 1.46, 0.11 ], [ [ "LeftLung", 255 ] ] ] ]);
  const geometry = geometryOf([ body ]);
  const mesh = { GetGeometryResource: () => geometry };
  const objects = [ { visualModel: { meshes: [ mesh, mesh ] } }, { visualModel: { meshes: [ { GetGeometryResource: () => null } ] } }, { visualModel: null } ];
  assert.equal(CjsBreastWeightFalloff.applyToObjects(objects, true), 1);
  assert.equal(geometry.uploads.length, 1);
  CjsBreastWeightFalloff.applyToObjects(objects, false);
});

test("a character's CMF mesh is reweighted in its channels, uploaded packed, and restored", () =>
{
  const geometry = cmfGeometryOf([ "LeftLung", "Spine3" ], [
    [ CENTRE, [ [ "LeftLung", 1 ] ] ], [ CENTRE, [ [ "LeftLung", 1 ] ] ], [ CENTRE, [ [ "LeftLung", 1 ] ] ],
    [ [ 0.08, 1.46, 0.11 ], [ [ "LeftLung", 0.2 ], [ "Spine3", 0.8 ] ] ]
  ]);
  const before = { weights: geometry.mesh.vertex.blendWeight.slice(), indices: geometry.mesh.vertex.blendIndice.slice() };

  assert.equal(CjsBreastWeightFalloff.applyToGeometry(geometry, true), 1);
  const { blendWeight: weights } = geometry.mesh.vertex;
  assert.deepEqual(weights.slice(0, 4), [ 1, 0, 0, 0 ], "the breast keeps its weight");
  assert.ok(Math.abs(weights[12]) < 1e-9 && Math.abs(weights[13] - 1) < 1e-9, "the collarbone's lung weight is now Spine3's");
  assert.equal(geometry.uploads.length, 1);
  // The fourth vertex's BoneWeights, packed at offset 20 of a 36-byte vertex.
  const view = new DataView(geometry.uploads[0].buffer, geometry.uploads[0].byteOffset);
  assert.ok(Math.abs(view.getFloat32(3 * 36 + 20, true)) < 1e-6 && Math.abs(view.getFloat32(3 * 36 + 24, true) - 1) < 1e-6);

  assert.equal(CjsBreastWeightFalloff.applyToGeometry(geometry, false), 1);
  assert.deepEqual(geometry.mesh.vertex.blendWeight, before.weights);
  assert.deepEqual(geometry.mesh.vertex.blendIndice, before.indices);
});
