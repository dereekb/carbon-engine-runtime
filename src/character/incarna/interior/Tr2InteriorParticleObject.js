// Incarna: retired from Carbon. Donor: trinity 71329945~1, Interior/Tr2InteriorParticleObject.h and _Blue.cpp. See ../README.md.
import { exposure as be } from "#be";
import { CjsSchema, type } from "#schema";
import { IRoot } from "#exposure/IRoot";
import { BlueList } from "../../../blue/exposure/BlueList.js";
import { Tr2Mesh } from "../../../trinity/core/mesh/Tr2Mesh.js";
import { TriCurveSet } from "../../../trinity/curves/TriCurveSet.js";
import { ITr2GenericEmitter } from "../../../trinity/particle/ITr2GenericEmitter/ITr2GenericEmitter.js";
import { Tr2ParticleSystem } from "../../../trinity/particle/Tr2ParticleSystem.js";

/**
 * A particle object in an Incarna interior. Data only: content loads, and
 * nothing draws it yet.
 *
 * Carbon removed the class in trinity 71329945 (2017-06-28). The members
 * here are those it persisted.
 *
 * @adapted data only
 */
export class Tr2InteriorParticleObject extends IRoot
{
  /** `m_name`. */
  name = "";

  /** `m_particleSystems`: the particle systems this object renders. */
  particleSystems = new BlueList(Tr2ParticleSystem, { className: "Tr2ParticleSystem", listOps: 0 });

  /** `m_emitters`: the object's particle emitters. */
  emitters = new BlueList(ITr2GenericEmitter, { className: "ITr2GenericEmitter", listOps: 0 });

  /** `m_meshes`: the meshes that render the particle systems. */
  meshes = new BlueList(Tr2Mesh, { className: "Tr2Mesh", listOps: 0 });

  /** `m_transform`. */
  transform = new Float32Array([ 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1 ]);

  /** `m_maxParticleRadius`: for the bounding box. */
  maxParticleRadius = 0;

  /** `m_shBoundsMin`: the SH lighting box's minimum. */
  shBoundsMin = new Float32Array(3);

  /** `m_shBoundsMax`: the SH lighting box's maximum. */
  shBoundsMax = new Float32Array(3);

  /** `m_depthOffset`: for transparency sorting. */
  depthOffset = 0;

  /** `m_curveSets`: curve sets that animate the systems and emitters. */
  curveSets = new BlueList(TriCurveSet, { className: "TriCurveSet", listOps: 0 });
}

// Declared imperatively, so this module stays plain ESM that loads from source without a transform.
CjsSchema.decorateField(Tr2InteriorParticleObject, "name", be.mapAttribute(be.READWRITE | be.PERSIST), type.string);
CjsSchema.decorateField(Tr2InteriorParticleObject, "particleSystems", be.mapAttribute(be.READWRITE | be.PERSIST), type.list("Tr2ParticleSystem"));
CjsSchema.decorateField(Tr2InteriorParticleObject, "emitters", be.mapAttribute(be.READWRITE | be.PERSIST), type.list("ITr2GenericEmitter"));
CjsSchema.decorateField(Tr2InteriorParticleObject, "meshes", be.mapAttribute(be.READWRITE | be.PERSIST), type.list("Tr2Mesh"));
CjsSchema.decorateField(Tr2InteriorParticleObject, "transform", be.mapAttribute(be.READWRITE | be.PERSIST | be.NOTIFY), type.mat4);
CjsSchema.decorateField(Tr2InteriorParticleObject, "maxParticleRadius", be.mapAttribute(be.READWRITE | be.PERSIST), type.float32);
CjsSchema.decorateField(Tr2InteriorParticleObject, "shBoundsMin", be.mapAttribute(be.READWRITE | be.PERSIST), type.vec3);
CjsSchema.decorateField(Tr2InteriorParticleObject, "shBoundsMax", be.mapAttribute(be.READWRITE | be.PERSIST), type.vec3);
CjsSchema.decorateField(Tr2InteriorParticleObject, "depthOffset", be.mapAttribute(be.READWRITE | be.PERSIST), type.float32);
CjsSchema.decorateField(Tr2InteriorParticleObject, "curveSets", be.mapAttribute(be.READWRITE | be.PERSIST), type.list("TriCurveSet"));
be.define("Tr2InteriorParticleObject")(Tr2InteriorParticleObject);
