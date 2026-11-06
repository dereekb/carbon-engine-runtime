import { CjsGraphTypeArray } from "./CjsGraphTypeArray.js";
import { CjsGraphTypeInt32 } from "./CjsGraphTypeInt32.js";

/**
 * Int32Array storage definition using shared typed-array operations.
 * Modelled on: Be::INTARRAY (blueexposure/BlueVariable.cpp:798-814).
 * @cjs JS buffers replace native storage; the native comparison policy is retained.
 */
export class CjsGraphTypeInt32Array extends CjsGraphTypeArray
{

  /** Definition name. */
  name = "Int32Array";

  /** Typed storage constructor. */
  static ctor = Int32Array;

  /** Scalar conversion shared with the numeric handler. */
  static element = CjsGraphTypeInt32;

  /** Stable class identity. */
  static className = "CjsGraphTypeInt32Array";

}
