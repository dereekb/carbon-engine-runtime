import { CjsGraphTypeArray } from "./CjsGraphTypeArray.js";
import { CjsGraphTypeInt16 } from "./CjsGraphTypeInt16.js";

/**
 * Int16Array storage definition using shared typed-array operations.
 * Modelled on: Be::Var array storage family (blueexposure/include/BlueTypes.h:234-236).
 * @cjs Additional JS typed storage; equality is exact element comparison, not native Blue dispatch.
 */
export class CjsGraphTypeInt16Array extends CjsGraphTypeArray
{

  /** Definition name. */
  name = "Int16Array";

  /** Typed storage constructor. */
  static ctor = Int16Array;

  /** Scalar conversion shared with the numeric handler. */
  static element = CjsGraphTypeInt16;

  /** Stable class identity. */
  static className = "CjsGraphTypeInt16Array";

}
