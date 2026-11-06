import { CjsGraphTypeArray } from "./CjsGraphTypeArray.js";
import { CjsGraphTypeInt8 } from "./CjsGraphTypeInt8.js";

/**
 * Int8Array storage definition using shared typed-array operations.
 * Modelled on: Be::Var array storage family (blueexposure/include/BlueTypes.h:234-236).
 * @cjs Additional JS typed storage; equality is exact element comparison, not native Blue dispatch.
 */
export class CjsGraphTypeInt8Array extends CjsGraphTypeArray
{

  /** Definition name. */
  name = "Int8Array";

  /** Typed storage constructor. */
  static ctor = Int8Array;

  /** Scalar conversion shared with the numeric handler. */
  static element = CjsGraphTypeInt8;

  /** Stable class identity. */
  static className = "CjsGraphTypeInt8Array";

}
