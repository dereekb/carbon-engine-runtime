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
 * It works on the vertices of every mesh bound to a lung joint, the body's
 * and any garment's, before or after their first upload: a CMF mesh's
 * channels (how character geometry is built) or a Granny mesh's bytes. Files
 * are untouched: the original weights and indices are kept, and turning the
 * pass off writes them back. Each breast centre is the weighted centroid of
 * its joint's influence across the geometry, in bind pose, with the weight
 * squared so the breast outweighs the fringe.
 *
 * Whether it runs is `CjsPaperDollDefinition.characterBreastWeightFalloff`,
 * off by default. Geometry resources are shared, so the pass applies to every
 * character drawing the same geometry.
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

  /** Each vertex set's original weights and indices, by the object holding its data, while the pass holds it changed. */
  static _originals = new WeakMap();

  /**
   * Applies or removes the pass on every mesh of the given skinned objects.
   *
   * @param {Iterable<object>} objects Skinned objects with a `visualModel`.
   * @param {boolean} enabled Whether the weights fall off (true) or are the files' own (false).
   * @returns {number} How many vertex sets changed.
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
   * Applies or removes the pass on one geometry's vertex sets, and uploads any
   * LOD already on the GPU again.
   *
   * @param {TriGeometryRes} geometry A loaded geometry.
   * @param {boolean} enabled Whether the weights fall off.
   * @returns {number} How many vertex sets changed.
   */
  static applyToGeometry(geometry, enabled)
  {
    if (!geometry.IsGood()) return 0;
    const sets = CjsBreastWeightFalloff.vertexSets(geometry);
    const centres = enabled ? CjsBreastWeightFalloff.centres(sets) : null;
    let changed = 0;
    for (const set of sets)
    {
      const original = CjsBreastWeightFalloff._originals.get(set.key);
      if (!enabled)
      {
        if (!original) continue;
        set.restore(original);
        CjsBreastWeightFalloff._originals.delete(set.key);
      }
      else
      {
        if (original) continue;
        const copy = set.snapshot();
        if (!CjsBreastWeightFalloff.reweight(set, centres)) continue;
        CjsBreastWeightFalloff._originals.set(set.key, copy);
      }
      set.changed = true;
      changed++;
    }
    if (changed) CjsBreastWeightFalloff._Upload(geometry, sets);
    return changed;
  }

  /**
   * Each lung joint's breast centre across vertex sets: the centroid of the
   * positions it weights, each weighted by its weight squared.
   *
   * @param {object[]} sets From `vertexSets`.
   * @returns {Map<string, Float64Array>} Centre by joint name, for joints that weight anything.
   */
  static centres(sets)
  {
    const sums = new Map();
    for (const set of sets)
    {
      for (let vertex = 0; vertex < set.count; vertex++)
      {
        for (let slot = 0; slot < 4; slot++)
        {
          const name = set.bindings[set.getIndex(vertex, slot)];
          if (!CjsBreastWeightFalloff.joints.includes(name)) continue;
          const weight = set.getWeight(vertex, slot) / set.unit;
          if (!weight) continue;
          const w2 = weight * weight;
          const sum = sums.get(name) ?? sums.set(name, new Float64Array(4)).get(name);
          for (let axis = 0; axis < 3; axis++) sum[axis] += set.position(vertex, axis) * w2;
          sum[3] += w2;
        }
      }
    }
    const centres = new Map();
    for (const [ name, sum ] of sums) if (sum[3] > 0) centres.set(name, Float64Array.of(sum[0] / sum[3], sum[1] / sum[3], sum[2] / sum[3]));
    return centres;
  }

  /**
   * Moves a vertex set's lung weight onto the target joint by the falloff, in
   * place. A vertex keeps four influences and its total: the lost weight goes
   * to the vertex's target slot, else an empty slot given the target joint,
   * else, when the set does not bind the target, its largest other influence.
   *
   * @param {object} set From `vertexSets`.
   * @param {Map<string, Float64Array>} centres From `centres`.
   * @returns {boolean} Whether any weight moved.
   */
  static reweight(set, centres)
  {
    const target = set.bindings.indexOf(CjsBreastWeightFalloff.target);
    const { innerRadius, outerRadius } = CjsBreastWeightFalloff;
    let moved = false;
    for (let vertex = 0; vertex < set.count; vertex++)
    {
      for (let slot = 0; slot < 4; slot++)
      {
        const centre = centres.get(set.bindings[set.getIndex(vertex, slot)]);
        const weight = set.getWeight(vertex, slot);
        if (!centre || !weight) continue;
        let squared = 0;
        for (let axis = 0; axis < 3; axis++)
        {
          const d = set.position(vertex, axis) - centre[axis];
          squared += d * d;
        }
        const t = Math.min(Math.max((Math.sqrt(squared) - innerRadius) / (outerRadius - innerRadius), 0), 1);
        const scaled = weight * (1 - t * t * (3 - 2 * t));
        const kept = set.unit === 1 ? scaled : Math.round(scaled);
        const lost = weight - kept;
        if (!lost) continue;
        const into = CjsBreastWeightFalloff._Receiver(set, vertex, slot, target);
        if (into < 0) continue;
        set.setWeight(vertex, slot, kept);
        if (target >= 0 && set.getWeight(vertex, into) === 0) set.setIndex(vertex, into, target);
        set.setWeight(vertex, into, set.getWeight(vertex, into) + lost);
        moved = true;
      }
    }
    return moved;
  }

  /**
   * The slot that takes a vertex's lost lung weight, or -1 for none.
   *
   * @param {object} set From `vertexSets`.
   * @param {number} vertex The vertex.
   * @param {number} from The losing slot.
   * @param {number} target The target joint's binding index, or -1.
   * @returns {number} The receiving slot.
   */
  static _Receiver(set, vertex, from, target)
  {
    if (target >= 0)
    {
      for (let slot = 0; slot < 4; slot++)
        if (slot !== from && set.getWeight(vertex, slot) && set.getIndex(vertex, slot) === target) return slot;
      for (let slot = 0; slot < 4; slot++) if (slot !== from && set.getWeight(vertex, slot) === 0) return slot;
    }
    let largest = -1;
    for (let slot = 0; slot < 4; slot++)
    {
      if (slot === from) continue;
      const weight = set.getWeight(vertex, slot);
      if (weight && (largest < 0 || weight > set.getWeight(vertex, largest))) largest = slot;
    }
    return largest;
  }

  /**
   * A geometry's vertex sets bound to a lung joint: one per CMF mesh LOD that
   * holds its own channels (else one for the mesh's), or one per Granny mesh.
   * Each gives positions, four weights and four binding indices per vertex,
   * the binding names, the weight unit (1 for CMF's floats, 255 for Granny's
   * normalised bytes), and how to snapshot and restore its weights.
   *
   * @param {TriGeometryRes} geometry The geometry.
   * @returns {object[]} The vertex sets.
   */
  static vertexSets(geometry)
  {
    const sets = [];
    const bound = bindings => CjsBreastWeightFalloff.joints.some(name => bindings.includes(name));
    if (geometry.IsUsingCMF())
    {
      for (const [ meshIndex, mesh ] of (geometry.GetCMFData()?.meshes ?? []).entries())
      {
        const bindings = (mesh.boneBindings ?? []).map(binding => binding.name);
        if (!bound(bindings)) continue;
        const holders = new Set([ ...(mesh.lods ?? []).map(lod => lod.vertex).filter(Boolean) ]);
        if (!holders.size || (mesh.lods ?? []).some(lod => !lod.vertex)) holders.add(mesh.vertex);
        for (const channels of holders)
        {
          const set = CjsBreastWeightFalloff._CmfSet(channels, bindings, meshIndex);
          if (set) sets.push(set);
        }
      }
      return sets;
    }
    for (const [ meshIndex, mesh ] of (geometry.GetGrannyInfo()?.Meshes ?? []).entries())
    {
      const bindings = (mesh.BoneBindings ?? []).map(binding => binding.BoneName);
      if (!bound(bindings)) continue;
      const set = CjsBreastWeightFalloff._GrannySet(mesh, bindings, meshIndex);
      if (set) sets.push(set);
    }
    return sets;
  }

  /**
   * A CMF channel set's accessor, or null without positions, four weights and four indices.
   *
   * @param {object} channels The `vertex` channels: `position`, `blendWeight`, `blendIndice`.
   * @param {string[]} bindings Bone binding names.
   * @param {number} meshIndex The CMF mesh.
   * @returns {object|null} The vertex set.
   */
  static _CmfSet(channels, bindings, meshIndex)
  {
    const { position, blendWeight: weights, blendIndice: indices } = channels ?? {};
    if (!position || !weights || !indices) return null;
    const count = position.length / 3;
    if (weights.length !== count * 4 || indices.length !== count * 4) return null;
    return {
      key: channels, kind: "cmf", meshIndex, bindings, count, unit: 1, changed: false,
      position: (vertex, axis) => position[vertex * 3 + axis],
      getWeight: (vertex, slot) => weights[vertex * 4 + slot],
      setWeight: (vertex, slot, value) => { weights[vertex * 4 + slot] = value; },
      getIndex: (vertex, slot) => indices[vertex * 4 + slot],
      setIndex: (vertex, slot, value) => { indices[vertex * 4 + slot] = value; },
      snapshot: () => ({ weights: Array.from(weights), indices: Array.from(indices) }),
      restore: ({ weights: w, indices: i }) => { for (let k = 0; k < w.length; k++) { weights[k] = w[k]; indices[k] = i[k]; } }
    };
  }

  /**
   * A Granny mesh's accessor over its interleaved bytes, or null unless it
   * holds Real32 positions, four NormalUInt8 weights and four UInt8 indices.
   *
   * @param {object} mesh A Granny mesh.
   * @param {string[]} bindings Bone binding names.
   * @param {number} meshIndex The Granny mesh.
   * @returns {object|null} The vertex set.
   */
  static _GrannySet(mesh, bindings, meshIndex)
  {
    const vertices = mesh.PrimaryVertexData?.Vertices;
    if (!vertices?.bytes) return null;
    const offsets = {};
    let offset = 0;
    for (const member of vertices.type)
    {
      offsets[member.name] = { offset, type: member.type, width: member.arrayWidth };
      offset += GrannyGetTotalTypeSize(member);
    }
    const { Position: p, BoneWeights: w, BoneIndices: i } = offsets;
    if (!p || p.type !== GRANNY_REAL32 || p.width !== 3) return null;
    if (!w || w.type !== GRANNY_NORMAL_UINT8 || w.width !== 4) return null;
    if (!i || i.type !== GRANNY_UINT8 || i.width !== 4) return null;
    const bytes = vertices.bytes, stride = vertices.stride;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return {
      key: vertices, kind: "granny", meshIndex, bindings, count: vertices.count, unit: 255, changed: false,
      position: (vertex, axis) => view.getFloat32(vertex * stride + p.offset + axis * 4, true),
      getWeight: (vertex, slot) => bytes[vertex * stride + w.offset + slot],
      setWeight: (vertex, slot, value) => { bytes[vertex * stride + w.offset + slot] = value; },
      getIndex: (vertex, slot) => bytes[vertex * stride + i.offset + slot],
      setIndex: (vertex, slot, value) => { bytes[vertex * stride + i.offset + slot] = value; },
      snapshot: () => bytes.slice(),
      restore: original => bytes.set(original)
    };
  }

  /**
   * Uploads each changed mesh again to the LODs already built from it, packed
   * as their first upload was (TriGeometryResAllocations). A LOD not yet on
   * the GPU takes the changed data at its first draw.
   *
   * @param {TriGeometryRes} geometry The geometry.
   * @param {object[]} sets Its vertex sets, `changed` marking those to upload.
   * @returns {void}
   */
  static _Upload(geometry, sets)
  {
    const context = Tr2RenderContext_GetMainThreadRenderContext();
    const changed = new Set(sets.filter(set => set.changed).map(set => set.meshIndex));
    const cmf = geometry.IsUsingCMF();
    const cmfMeshes = cmf ? geometry.GetCMFData()?.meshes ?? [] : null;
    const grannyMeshes = cmf ? null : geometry.GetGrannyInfo()?.Meshes ?? [];
    for (let meshIndex = 0; meshIndex < geometry.GetMeshCount(); meshIndex++)
    {
      for (let lodIndex = 0; ; lodIndex++)
      {
        const lod = geometry.GetMeshLod__LodIndex(meshIndex, lodIndex);
        if (!lod) break;
        if (!lod.allocationsValid) continue;
        if (cmf)
        {
          if (!changed.has(meshIndex)) continue;
          const mesh = cmfMeshes[meshIndex];
          const packed = TriGeometryRes.packLodGeometry(mesh, mesh.lods?.length ? lod.originalLodIndex : 0);
          lod.vertexAllocation.Update(packed.vertex.bytes, context);
        }
        else
        {
          if (!changed.has(lod.grannyMeshIndex)) continue;
          const vertices = grannyMeshes[lod.grannyMeshIndex].PrimaryVertexData.Vertices;
          const packed = TriGeometryRes.alignStride({ bytes: vertices.bytes, stride: vertices.stride, count: vertices.count });
          lod.vertexAllocation.Update(packed.bytes, context);
        }
      }
    }
  }
}

/** Granny member type codes the pass reads (resource/formats/gr2/core/shared.js). */
const GRANNY_REAL32 = 10, GRANNY_UINT8 = 12, GRANNY_NORMAL_UINT8 = 14;
