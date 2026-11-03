// Source: trinity/trinity/Curves/Tr2CurveVector2.h
// Source: trinity/trinity/Curves/Tr2CurveVector2.cpp
import { exposure as be } from "#be";
import { vec2 } from "#math/vec2";
import { ITriFunction, ITriCurveLength } from "#blue";
import { type } from "#schema";
import { Tr2CurveInterpolation, Tr2CurveTangentType } from "../enums.js";
import { Tr2CurveScalar } from "./Tr2CurveScalar.js";


/**
 * Two-component vector curve composed of independent scalar curves for x and y;
 * its length is the longer of the two.
 * JavaScript writes native returned vectors into caller-owned output buffers.
 */
@be.define({
  name: "Tr2CurveVector2",
  inherit: [ ITriCurveLength ],
  // Tr2CurveVector2_Blue.cpp:10-54, in Carbon's order.
  interfaces: [ ITriFunction, ITriCurveLength ],
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "x", be.READ | be.PERSIST ],
    [ be.ATTR, "y", be.READ | be.PERSIST ],
    [ be.ATTR, "currentValue", be.READ ],
    [ be.METHOD, "GetValueAt", be.WRAP, "GetValue" ],
    [ be.METHOD, "AddKey", be.WRAP_OPTIONAL_ARGS ],
    [ be.METHOD, "SetExtrapolation", be.WRAP ]
  ]
})
export class Tr2CurveVector2 extends ITriFunction
{
  /**
   * Authored curve label stored as native std::string.
   * @type {string}
   */

  @type.string
  name = "";

  /**
   * Owned scalar curve for the horizontal vector component.
   * @type {Tr2CurveScalar}
   */

  @type.object.embed("Tr2CurveScalar")
  x = new Tr2CurveScalar();

  /**
   * Owned scalar curve for the vertical vector component.
   * @type {Tr2CurveScalar}
   */

  @type.object.embed("Tr2CurveScalar")
  y = new Tr2CurveScalar();

  /**
   * Cached two-component vector assembled from the x and y scalar curves.
   * @type {Float32Array}
   */
  @type.vec2
  currentValue = vec2.create();

  /**
   * Updates the cached vector value by updating each scalar component curve.
   *
   * @implemented
   * @param {number} time Time in seconds.
   * @returns {void}
   */

  UpdateValue(time)
  {
    this.currentValue[0] = this.x.Update(time);
    this.currentValue[1] = this.y.Update(time);
  }

  /**
   * Gets the longest scalar component curve length.
   *
   * @implemented
   * @returns {number} Longest scalar component length.
   */

  Length()
  {
    return Math.max(this.x.Length(), this.y.Length());
  }

  /**
   * Gets the vector value at `time` into `out`.
   *
   * @adapted
   * @param {number} time Time in seconds.
   * @param {Float32Array|number[]} out Caller-owned output.
   * @returns {Float32Array|number[]} The caller-owned output.
   */
  GetValue(time, out)
  {
    return this.GetValueAt(time, out);
  }

  /**
   * Adds one vector key by adding matching scalar keys to each component curve.
   * Native right-tangent selection is gated by left-tangent presence. JavaScript
   * also treats a missing right array as zero; right-only input remains ignored.
   *
   * @adapted
   * @param {number} time Time in seconds.
   * @param {Float32Array|number[]} value Authored component values.
   * @param {number} [interpolation = Tr2CurveInterpolation.HERMITE] Interpolation for the following segment.
   * @param {Float32Array|number[]} [leftTangent] Optional arriving component tangents.
   * @param {Float32Array|number[]} [rightTangent] Optional departing component tangents.
   * @param {number} [tangentType = Tr2CurveTangentType.AUTO_CLAMP] Scalar tangent-maintenance rule.
   * @returns {void}
   */
  AddKey(time, value, interpolation = Tr2CurveInterpolation.HERMITE, leftTangent, rightTangent, tangentType = Tr2CurveTangentType.AUTO_CLAMP)
  {
    const useRightTangent = !!leftTangent && !!rightTangent;
    this.x.AddKey(time, value[0], interpolation, leftTangent?.[0] ?? 0, useRightTangent ? rightTangent[0] : 0, tangentType);
    this.y.AddKey(time, value[1], interpolation, leftTangent?.[1] ?? 0, useRightTangent ? rightTangent[1] : 0, tangentType);
  }

  /**
   * Sets extrapolation on all scalar component curves.
   *
   * @implemented
   * @param {number} extrapolation Before and after extrapolation mode.
   * @returns {void}
   */
  SetExtrapolation(extrapolation)
  {
    this.x.SetExtrapolation(extrapolation);
    this.y.SetExtrapolation(extrapolation);
  }

  /**
   * Gets the vector value at `time` into `out`.
   *
   * @adapted
   * @param {number} time Time in seconds.
   * @param {Float32Array|number[]} out Caller-owned output.
   * @returns {Float32Array|number[]} The caller-owned output.
   */
  GetValueAt(time, out)
  {
    out[0] = this.x.GetValue(time);
    out[1] = this.y.GetValue(time);
    return out;
  }
}

// Native exposure ends at this concrete table (Tr2CurveVector2_Blue.cpp).
