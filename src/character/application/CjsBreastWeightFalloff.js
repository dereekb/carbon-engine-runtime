// Ours: no Carbon donor. Carbon has no secondary motion, jiggle or spring bone, and never rewrites skin weights.
import { Tr2RenderContext_GetMainThreadRenderContext } from "../../trinity/core/context/Tr2RenderContext.js";
import { TriGeometryRes } from "../../trinity/resources/geometry/TriGeometryRes.js";
import { GrannyGetTotalTypeSize } from "../../trinity/utilities/geometryUtils.js";

/**
 * Localises breast motion by moving skin weight off the chest joints, in memory.
 *
 * The female body's LeftLung and RightLung weights are almost flat over the
 * whole breast (none above 0.40), and their lower weights reach the
 * collarbone, the side under the arm and the chest wall. A motion that moves
 * those joints therefore moves the whole patch. This pass scales each
 * vertex's lung weight by a smooth falloff from that side's breast centre
 * and gives the rest to `Spine3`, which the lung joints hang from. Inside
 * `innerRadius` the weight is kept whole; beyond `outerRadius` it is gone.
 *
 * It works on the decoded Granny vertices of every mesh bound to a lung
 * joint, the body's and any garment's, before or after their first upload.
 * Files are untouched: the original bytes are kept, and turning the pass off
 * writes them back. Each breast centre is the weighted centroid of its
 * joint's influence across the geometry, in bind pose, with the weight
 * squared so the breast outweighs the fringe.
 *
 * Whether it runs is `CjsPaperDollDefinition.characterBreastWeightFalloff`,
 * off by default. Geometry resources are shared, so the pass applies to every
 * character drawing the same file.
 *
 * Not Carbon's: non-carbon-extensions.md § Breast weight falloff.
 */
export class CjsBreastWeightFalloff
{
  static className = "CjsBreastWeightFalloff";

  /** Distance from a breast centre, in metres, inside which a vertex keeps its whole lung weight. */
  static innerRadius = 0.05;

  /** Distance from a breast centre, in metres, beyond which a vertex keeps no lung weight. */
  static outerRadius = 0.12;

  /** The joints whose weight falls off, and the joint that takes what they lose. */
  static joints = Object.freeze([ "LeftLung", "RightLung" ]);
  static target = "Spine3";

  /** Each Granny vertex block's original bytes, while the pass holds it changed. */
  static _originals = new WeakMap();

  /**
   * Applies or removes the pass on every mesh of the given skinned objects.
   *
   * @param {Iterable<object>} objects Skinned objects with a `visualModel`.
   * @param {boolean} enabled Whether the weights fall off (true) or are the files' own (false).
   * @returns {number} How many Granny meshes changed.
   */
  static applyToObjects(objects, enabled)
  {
    const seen = new Set();
    let changed = 0;
    for (const object of objects)
    {
      for (const mesh of object.visualModel?.meshes ?? [])
      {
        const geometry = mesh.GetGeometryResource();
        if (!geometry || seen.has(geometry)) continue;
        seen.add(geometry);
        changed += CjsBreastWeightFalloff.applyToGeometry(geometry, enabled);
      }
    }
    return changed;
  }

  /**
   * Applies or removes the pass on one geometry's Granny meshes, and uploads
   * any LOD already on the GPU again.
   *
   * @param {TriGeometryRes} geometry A loaded geometry.
   * @param {boolean} enabled Whether the weights fall off.
   * @returns {number} How many Granny meshes changed.
   */
  static applyToGeometry(geometry, enabled)
  {
    if (!geometry.IsGood() || geometry.IsUsingCMF()) return 0;
    const meshes = geometry.GetGrannyInfo()?.Meshes ?? [];
    const centres = enabled ? CjsBreastWeightFalloff.centres(meshes) : null;
    const changedMeshes = new Set();
    for (let index = 0; index < meshes.length; index++)
    {
      const vertices = meshes[index].PrimaryVertexData?.Vertices;
      if (!vertices) continue;
      const original = CjsBreastWeightFalloff._originals.get(vertices);
      if (!enabled)
      {
        if (!original) continue;
        vertices.bytes.set(original);
        CjsBreastWeightFalloff._originals.delete(vertices);
        changedMeshes.add(index);
        continue;
      }
      if (original) continue;
      const copy = vertices.bytes.slice();
      if (CjsBreastWeightFalloff.reweight(meshes[index], centres))
      {
        CjsBreastWeightFalloff._originals.set(vertices, copy);
        changedMeshes.add(index);
      }
    }
    if (changedMeshes.size) CjsBreastWeightFalloff._Upload(geometry, meshes, changedMeshes);
    return changedMeshes.size;
  }

  /**
   * Each lung joint's breast centre across a geometry's meshes: the centroid
   * of the positions it weights, each weighted by its weight squared.
   *
   * @param {object[]} meshes Granny meshes.
   * @returns {Map<string, Float64Array>} Centre by joint name, for joints that weight anything.
   */
  static centres(meshes)
  {
    const sums = new Map();
    for (const mesh of meshes)
    {
      const layout = CjsBreastWeightFalloff.layout(mesh);
      if (!layout) continue;
      const { view, stride, count, position, weights, indices, bindings } = layout;
      for (let vertex = 0; vertex < count; vertex++)
      {
        const base = vertex * stride;
        for (let slot = 0; slot < 4; slot++)
        {
          const name = bindings[view.getUint8(base + indices + slot)];
          if (!CjsBreastWeightFalloff.joints.includes(name)) continue;
          const weight = view.getUint8(base + weights + slot) / 255;
          if (!weight) continue;
          const w2 = weight * weight;
          const sum = sums.get(name) ?? sums.set(name, new Float64Array(4)).get(name);
          for (let axis = 0; axis < 3; axis++) sum[axis] += view.getFloat32(base + position + axis * 4, true) * w2;
          sum[3] += w2;
        }
      }
    }
    const centres = new Map();
    for (const [ name, sum ] of sums) if (sum[3] > 0) centres.set(name, Float64Array.of(sum[0] / sum[3], sum[1] / sum[3], sum[2] / sum[3]));
    return centres;
  }

  /**
   * Moves one mesh's lung weight onto the target joint by the falloff, in
   * place. A vertex keeps four influences summing to 255: the lost weight goes
   * to the vertex's target slot, else an empty slot given the target joint,
   * else, when the mesh does not bind the target, its largest other influence.
   *
   * @param {object} mesh A Granny mesh.
   * @param {Map<string, Float64Array>} centres From `centres`.
   * @returns {boolean} Whether any weight moved.
   */
  static reweight(mesh, centres)
  {
    const layout = CjsBreastWeightFalloff.layout(mesh);
    if (!layout) return false;
    const { view, stride, count, position, weights, indices, bindings } = layout;
    const target = bindings.indexOf(CjsBreastWeightFalloff.target);
    const { innerRadius, outerRadius } = CjsBreastWeightFalloff;
    let moved = false;
    for (let vertex = 0; vertex < count; vertex++)
    {
      const base = vertex * stride;
      for (let slot = 0; slot < 4; slot++)
      {
        const centre = centres.get(bindings[view.getUint8(base + indices + slot)]);
        const weight = view.getUint8(base + weights + slot);
        if (!centre || !weight) continue;
        let squared = 0;
        for (let axis = 0; axis < 3; axis++)
        {
          const d = view.getFloat32(base + position + axis * 4, true) - centre[axis];
          squared += d * d;
        }
        const t = Math.min(Math.max((Math.sqrt(squared) - innerRadius) / (outerRadius - innerRadius), 0), 1);
        const kept = Math.round(weight * (1 - t * t * (3 - 2 * t)));
        const lost = weight - kept;
        if (!lost) continue;
        const into = CjsBreastWeightFalloff._Receiver(view, base, weights, indices, slot, target);
        if (into < 0) continue;
        view.setUint8(base + weights + slot, kept);
        if (target >= 0 && view.getUint8(base + weights + into) === 0) view.setUint8(base + indices + into, target);
        view.setUint8(base + weights + into, view.getUint8(base + weights + into) + lost);
        moved = true;
      }
    }
    return moved;
  }

  /**
   * The slot that takes a vertex's lost lung weight, or -1 for none.
   *
   * @param {DataView} view Vertex bytes.
   * @param {number} base The vertex's byte offset.
   * @param {number} weights BoneWeights' offset in a vertex.
   * @param {number} indices BoneIndices' offset in a vertex.
   * @param {number} from The losing slot.
   * @param {number} target The target joint's binding index, or -1.
   * @returns {number} The receiving slot.
   */
  static _Receiver(view, base, weights, indices, from, target)
  {
    if (target >= 0)
    {
      for (let slot = 0; slot < 4; slot++)
        if (slot !== from && view.getUint8(base + weights + slot) && view.getUint8(base + indices + slot) === target) return slot;
      for (let slot = 0; slot < 4; slot++) if (slot !== from && view.getUint8(base + weights + slot) === 0) return slot;
    }
    let largest = -1;
    for (let slot = 0; slot < 4; slot++)
    {
      if (slot === from) continue;
      const weight = view.getUint8(base + weights + slot);
      if (weight && (largest < 0 || weight > view.getUint8(base + weights + largest))) largest = slot;
    }
    return largest;
  }

  /**
   * Where a Granny mesh keeps what the pass reads: Real32 positions, four
   * NormalUInt8 weights and four UInt8 binding indices. Null for any other
   * layout, or a mesh not bound to a lung joint.
   *
   * @param {object} mesh A Granny mesh.
   * @returns {object|null} The view, stride, count, member offsets and binding names.
   */
  static layout(mesh)
  {
    const bindings = (mesh.BoneBindings ?? []).map(binding => binding.BoneName);
    if (!CjsBreastWeightFalloff.joints.some(name => bindings.includes(name))) return null;
    const vertices = mesh.PrimaryVertexData?.Vertices;
    if (!vertices?.bytes) return null;
    const offsets = {};
    let offset = 0;
    for (const member of vertices.type)
    {
      offsets[member.name] = { offset, type: member.type, width: member.arrayWidth };
      offset += GrannyGetTotalTypeSize(member);
    }
    const { Position: position, BoneWeights: weights, BoneIndices: indices } = offsets;
    if (!position || position.type !== GRANNY_REAL32 || position.width !== 3) return null;
    if (!weights || weights.type !== GRANNY_NORMAL_UINT8 || weights.width !== 4) return null;
    if (!indices || indices.type !== GRANNY_UINT8 || indices.width !== 4) return null;
    const bytes = vertices.bytes;
    return {
      view: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), stride: vertices.stride, count: vertices.count,
      position: position.offset, weights: weights.offset, indices: indices.offset, bindings
    };
  }

  /**
   * Uploads each changed Granny mesh again to the LODs already built from it.
   * A LOD not yet on the GPU takes the changed bytes at its first draw.
   *
   * @param {TriGeometryRes} geometry The geometry.
   * @param {object[]} meshes Its Granny meshes.
   * @param {Set<number>} changed Indices of the changed Granny meshes.
   * @returns {void}
   */
  static _Upload(geometry, meshes, changed)
  {
    const context = Tr2RenderContext_GetMainThreadRenderContext();
    for (let meshIndex = 0; meshIndex < geometry.GetMeshCount(); meshIndex++)
    {
      for (let lodIndex = 0; ; lodIndex++)
      {
        const lod = geometry.GetMeshLod__LodIndex(meshIndex, lodIndex);
        if (!lod) break;
        if (!lod.allocationsValid || !changed.has(lod.grannyMeshIndex)) continue;
        const vertices = meshes[lod.grannyMeshIndex].PrimaryVertexData.Vertices;
        const packed = TriGeometryRes.alignStride({ bytes: vertices.bytes, stride: vertices.stride, count: vertices.count });
        lod.vertexAllocation.Update(packed.bytes, context);
      }
    }
  }
}

/** Granny member type codes the pass reads (resource/formats/gr2/core/shared.js). */
const GRANNY_REAL32 = 10, GRANNY_UINT8 = 12, GRANNY_NORMAL_UINT8 = 14;
