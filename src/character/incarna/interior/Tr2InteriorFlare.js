// Incarna: retired from Carbon. Donor: trinity 71329945~1, Interior/Tr2InteriorFlare.h and _Blue.cpp. See ../README.md.
import { exposure as be } from "#be";
import { CjsSchema, type } from "#schema";
import { IRoot } from "#exposure/IRoot";
import { mat4 } from "#math/mat4";
import { vec4 } from "#math/vec4";
import { BlueList } from "../../../blue/exposure/BlueList.js";
import { TriCurveSet } from "../../../trinity/curves/TriCurveSet.js";
import { Tr2InteriorFlareData } from "./Tr2InteriorFlareData.js";

/**
 * A lens flare in an Incarna interior. Data only: content loads, and nothing
 * draws it yet. Drawing needs Carbon's occlusion queries and flare passes.
 *
 * Carbon removed the class in trinity 71329945 (2017-06-28). The members
 * here are those it persisted; its `occluderMaterial` is not persisted.
 *
 * @adapted data only
 */
export class Tr2InteriorFlare extends IRoot
{
  /** `m_name`. */
  name = "";

  /** `m_transform`: flare local space to world space. */
  transform = mat4.create();

  /** `m_color`. */
  color = vec4.fromValues(1, 1, 1, 1);

  /** `m_curveSets`: curve sets that animate the flare. */
  curveSets = new BlueList(TriCurveSet, { className: "TriCurveSet", listOps: 0 });

  /** `m_occluderSize`: the occluder billboard's radius in world units. */
  occluderSize = 0;

  /** `m_transparentFlareMaterial`: the flare's material during the material pass. */
  transparentFlareMaterial = null;

  /** `m_flareMaterial`: the flare's material during the flare pass. */
  flareMaterial = null;

  /** `m_flareData`: the images of the flare pass. */
  flareData = new BlueList(Tr2InteriorFlareData, { className: "Tr2InteriorFlareData", listOps: 0 });

  /** `m_transparentFlareData`: the images of the material pass. */
  transparentFlareData = new BlueList(Tr2InteriorFlareData, { className: "Tr2InteriorFlareData", listOps: 0 });
}

// Declared imperatively, so this module stays plain ESM that loads from source without a transform.
CjsSchema.decorateField(Tr2InteriorFlare, "name", be.mapAttribute(be.READWRITE | be.PERSIST), type.string);
CjsSchema.decorateField(Tr2InteriorFlare, "transform", be.mapAttribute(be.READWRITE | be.PERSIST | be.NOTIFY), type.mat4);
CjsSchema.decorateField(Tr2InteriorFlare, "color", be.mapAttribute(be.READWRITE | be.PERSIST), type.color);
CjsSchema.decorateField(Tr2InteriorFlare, "curveSets", be.mapAttribute(be.READWRITE | be.PERSIST), type.list("TriCurveSet"));
CjsSchema.decorateField(Tr2InteriorFlare, "occluderSize", be.mapAttribute(be.READWRITE | be.PERSIST | be.NOTIFY), type.float32);
CjsSchema.decorateField(Tr2InteriorFlare, "transparentFlareMaterial", be.mapAttribute(be.READWRITE | be.PERSIST), type.object.ref("Tr2ShaderMaterial"));
CjsSchema.decorateField(Tr2InteriorFlare, "flareMaterial", be.mapAttribute(be.READWRITE | be.PERSIST), type.object.ref("Tr2ShaderMaterial"));
CjsSchema.decorateField(Tr2InteriorFlare, "flareData", be.mapAttribute(be.READWRITE | be.PERSIST), type.list("Tr2InteriorFlareData"));
CjsSchema.decorateField(Tr2InteriorFlare, "transparentFlareData", be.mapAttribute(be.READWRITE | be.PERSIST), type.list("Tr2InteriorFlareData"));
be.define("Tr2InteriorFlare")(Tr2InteriorFlare);
