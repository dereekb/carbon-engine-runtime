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

  /**
   * Carbon: AreEqual default (blueexposure/BlueVariable.cpp:111-114).
   * @implemented No native specialisation exists, including for empty/equal arrays.
   * IsExactEqual and Set's change detection remain useful independently.
   */
  static hasValueEquality = false;

  /** Stable class identity. */
  static className = "CjsGraphTypeInt32Array";

}
