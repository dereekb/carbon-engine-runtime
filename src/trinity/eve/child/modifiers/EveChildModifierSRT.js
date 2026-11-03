// Source: trinity/trinity/Eve/SpaceObject/Children/TransformModifiers/EveChildModifierSRT.h
// Source: trinity/trinity/Eve/SpaceObject/Children/TransformModifiers/EveChildModifierSRT.cpp
import { exposure as be } from "#be";
import { mat4 } from "#math/mat4";
import { quat } from "#math/quat";
import { vec3 } from "#math/vec3";
import { IEveChildTransformModifier } from "./IEveChildTransformModifier.js";
import { type } from "#schema";


/**
 * Transform modifier that applies a fixed scale, rotation and translation ahead
 * of the child's own transform.
 */
@be.define({
  name: "EveChildModifierSRT",
  // EveChildModifierSRT_Blue.cpp:11-17, in Carbon's order.
  interfaces: [ IEveChildTransformModifier ],
  members: [
    [ be.ATTR, "scaling", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "rotation", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "translation", be.READWRITE | be.PERSIST ]
  ]
})
export class EveChildModifierSRT extends IEveChildTransformModifier
{
  @type.vec3
  scaling = vec3.fromValues(1, 1, 1);

  @type.quat
  rotation = quat.create();

  @type.vec3
  translation = vec3.create();

  static _scratch = mat4.create();

  /**
   * Applies this modifier's scale/rotation/translation before the incoming
   * transform (Carbon EveChildModifierSRT::ApplyTransform:
   * TransformationMatrix(s,r,t) * transform in row-vector convention - SRT
   * first, then transform, which is mat4.multiply(out, transform, srt) in
   * gl-matrix). The returned Matrix is written into caller-owned `out`.
   *
   * @implemented
   * @param {Float32Array} transform - source (read only)
   * @param {Number} [_boneCount] - Carbon signature parity, unused
   * @param {Float32Array} [_bones] - Carbon signature parity, unused
   * @param {Float32Array} out - caller-owned; receives the result
   * @returns {Float32Array} out
   */

  ApplyTransform(transform, _boneCount = 0, _bones = null, out)
  {
    const local = mat4.fromRotationTranslationScale(
      EveChildModifierSRT._scratch,
      this.rotation,
      this.translation,
      this.scaling
    );
    return mat4.multiply(out, transform, local);
  }
}
