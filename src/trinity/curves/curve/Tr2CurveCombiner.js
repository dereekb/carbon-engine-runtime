// Source: trinity/trinity/Curves/Tr2CurveCombiner.h
// Source: trinity/trinity/Curves/Tr2CurveCombiner.cpp
import { exposure as be } from "#be";
import { vec3 } from "#math/vec3";
import { ITriFunction, ITriVectorFunction, ITriCurveLength, BlueList, blue, BlueClasses } from "#blue";
import { type } from "#schema";


/**
 * Vector function returning the component-wise sum of every child vector
 * function sampled at the same time; its length is the longest child's length.
 */
@be.define({
  name: "Tr2CurveCombiner",
  inherit: [ ITriCurveLength ],
  // Tr2CurveCombiner_Blue.cpp:10-34, in Carbon's order.
  interfaces: [ ITriFunction, ITriVectorFunction, ITriCurveLength ],
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "curves", be.READ | be.PERSIST ],
    [ be.ATTR, "currentValue", be.READ ],
    [ be.METHOD, "GetValueAt", be.WRAP, "GetValue" ]
  ]
})
export class Tr2CurveCombiner extends ITriVectorFunction
{
  /**
   * Name identifying this vector-function combiner (native std::string m_name).
   * @type {string}
   */

  @type.string
  name = "";

  /**
   * Typed child-vector list whose sampled values are summed (native PITriVectorFunctionVector m_curves).
   * @type {BlueList<ITriVectorFunction>}
   */

  @type.list("ITriVectorFunction")
  curves = new BlueList(ITriVectorFunction, { className: null, listOps: 0 });

  /**
   * Three-component sum committed after all child updates succeed (native Vector3 m_currentValue).
   * @type {Float32Array}
   */
  @type.vec3
  currentValue = vec3.create();

  /**
   * Reusable JavaScript child-sample buffer for GetValueAt; UpdateValue uses invocation-local pool leases.
   * @type {Float32Array}
   */
  _childValue = vec3.create();

  /**
   * Updates every child with zeroed pooled scratch and commits the sum after success.
   * Invocation-local leases preserve nested updates and are released on failure.
   *
   * @implemented
   * @param {number} time Time in seconds.
   * @returns {void}
   */

  UpdateValue(time)
  {
    const sum = vec3.alloc();
    try
    {
      vec3.zero(sum);
      const childValue = vec3.alloc();
      try
      {
        for (const curve of this.curves)
        {
          vec3.zero(childValue);
          curve.Update(time, childValue);
          vec3.add(sum, sum, childValue);
        }
        vec3.copy(this.currentValue, sum);
      }
      finally
      {
        vec3.unalloc(childValue);
      }
    }
    finally
    {
      vec3.unalloc(sum);
    }
  }

  /**
   * Carbon's Update(Be::Time): every child updates through its own Be::Time overload, and the sum is cached
   * (Tr2CurveCombiner.cpp:45-58). JavaScript cannot overload on argument type, so the Be::Time overload has its own name.
   *
   * @adapted
   * @param {number} time Scene time in Blue 100ns ticks.
   * @param {Float32Array} out Destination value.
   * @returns {Float32Array} The destination.
   */
  Update__Ticks(time, out)
  {
    const sum = vec3.alloc();
    try
    {
      vec3.zero(sum);
      const childValue = vec3.alloc();
      try
      {
        for (const curve of this.curves)
        {
          vec3.zero(childValue);
          curve.Update__Ticks(time, childValue);
          vec3.add(sum, sum, childValue);
        }
        vec3.copy(this.currentValue, sum);
      }
      finally
      {
        vec3.unalloc(childValue);
      }
    }
    finally
    {
      vec3.unalloc(sum);
    }
    return vec3.copy(out, this.currentValue);
  }

  /**
   * Returns the longest child exposing the exact native curve-length interface.
   * JavaScript mapped constructor identities implement native BlueCastPtr; an exposed Length method is required.
   *
   * @adapted
   * @returns {number} Duration in seconds.
   */

  Length()
  {
    let maxLength = 0;
    for (const curve of this.curves)
    {
      if (blue.classes.QueryThisInterface(curve, ITriCurveLength, curve.constructor, BlueClasses.BLUEQIOPT.BEQI_SILENT) !== null)
      {
        maxLength = Math.max(curve.Length(), maxLength);
      }
    }
    return maxLength;
  }

  /**
   * Samples into a caller-owned destination instead of returning a native value.
   *
   * @adapted
   * @param {number} time Time in seconds.
   * @param {Float32Array} out Destination value.
   * @returns {Float32Array} The destination.
   */
  GetValue(time, out)
  {
    return this.GetValueAt(time, out);
  }

  /**
   * Updates the summed cache and copies it to the destination.
   * JavaScript uses seconds-first/output-last calls instead of native overloads.
   *
   * @adapted
   * @param {number} time Time in seconds.
   * @param {Float32Array} out Destination value.
   * @returns {Float32Array} The destination.
   */

  Update(time, out)
  {
    this.UpdateValue(time);
    return vec3.copy(out, this.currentValue);
  }

  /**
   * Samples the existing child-sum algorithm into the output.
   * JavaScript uses seconds-first/output-last calls; native tick overloads are not dispatched.
   *
   * @adapted
   * @param {number} time Time in seconds.
   * @param {Float32Array} out Destination value.
   * @returns {Float32Array} The destination.
   */
  GetValueAt(time, out)
  {
    vec3.zero(out);
    for (const curve of this.curves)
    {
      curve.GetValueAt(time, this._childValue);
      vec3.add(out, out, this._childValue);
    }
    return out;
  }

  /**
   * Retains the native no-op first derivative.
   *
   * @adapted
   * @param {number} _time Unused time.
   * @param {Float32Array} out Destination value.
   * @returns {Float32Array} The unchanged destination.
   */

  GetValueDotAt(_time, out)
  {
    return out;
  }

  /**
   * Retains the native no-op second derivative.
   *
   * @adapted
   * @param {number} _time Unused time.
   * @param {Float32Array} out Destination value.
   * @returns {Float32Array} The unchanged destination.
   */

  GetValueDoubleDotAt(_time, out)
  {
    return out;
  }

  /**
   * Retains the native no-op interpolated position.
   *
   * @adapted
   * @param {number} _time Unused time.
   * @param {Float32Array|Float64Array} out Destination position.
   * @returns {Float32Array|Float64Array} The unchanged destination.
   */

  InterpolatedPosition(_time, out)
  {
    return out;
  }
}

// Exact native exposure table, with no inherited exposure chain.
