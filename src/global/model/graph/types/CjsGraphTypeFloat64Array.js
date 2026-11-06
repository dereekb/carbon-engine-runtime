import { CjsGraphTypeArray } from "./CjsGraphTypeArray.js";
import { CjsGraphTypeFloat64 } from "./CjsGraphTypeFloat64.js";

/**
 * Float64Array storage definition using shared typed-array operations.
 * Modelled on: Be::DOUBLEARRAY (blueexposure/BlueVariable.cpp:779-795).
 * @cjs JS buffers replace native storage; the native comparison policy is retained.
 */
export class CjsGraphTypeFloat64Array extends CjsGraphTypeArray
{

  /** Definition name. */
  name = "Float64Array";

  /** Typed storage constructor. */
  static ctor = Float64Array;

  /** Scalar conversion shared with the numeric handler. */
  static element = CjsGraphTypeFloat64;

  /** Stable class identity. */
  static className = "CjsGraphTypeFloat64Array";

}
