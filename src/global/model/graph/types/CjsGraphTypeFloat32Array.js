import { CjsGraphTypeArray } from "./CjsGraphTypeArray.js";
import { CjsGraphTypeFloat32 } from "./CjsGraphTypeFloat32.js";

/**
 * Float32Array storage definition using shared typed-array operations.
 * Modelled on: Be::FLOATARRAY (blueexposure/BlueVariable.cpp:735-775).
 * @cjs JS buffers replace native storage; the native comparison policy is retained.
 */
export class CjsGraphTypeFloat32Array extends CjsGraphTypeArray
{

  /** Definition name. */
  name = "Float32Array";

  /**
   * Carbon: IsArrayEqual (blueexposure/BlueVariable.cpp:39-50).
   * @adapted Rejects differences >= epsilon, preserving the native NaN comparison quirk.
   */
  static equalElement(a, b)
  {
    return !(Math.abs(Math.fround(a - b)) >= Math.fround(1e-6));
  }

  /**
   * A stored NaN is always overwritten, though Carbon's IsArrayEqual calls it equal (CE-202).
   * @cjs Set's rule only; isEqual keeps the quirk.
   */
  static isUnchanged(stored, value)
  {
    for (let i = 0; i < stored.length; i++)
    {
      if (Number.isNaN(stored[i])) return false;
    }

    return super.isUnchanged(stored, value);
  }

  /** Typed storage constructor. */
  static ctor = Float32Array;

  /** Scalar conversion shared with the numeric handler. */
  static element = CjsGraphTypeFloat32;

  /** Stable class identity. */
  static className = "CjsGraphTypeFloat32Array";

}
