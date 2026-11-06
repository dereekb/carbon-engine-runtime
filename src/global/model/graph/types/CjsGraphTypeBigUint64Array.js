import { CjsGraphTypeArray } from "./CjsGraphTypeArray.js";
import { CjsGraphTypeUint64 } from "./CjsGraphTypeUint64.js";

/**
 * BigUint64Array storage definition using shared typed-array operations.
 * Modelled on: Be::Var array storage family (blueexposure/include/BlueTypes.h:234-236).
 * @cjs Additional JS typed storage; equality is exact element comparison, not native Blue dispatch.
 */
export class CjsGraphTypeBigUint64Array extends CjsGraphTypeArray
{

  /** Definition name. */
  name = "BigUint64Array";

  /** Typed storage constructor. */
  static ctor = BigUint64Array;

  /** Scalar conversion shared with the numeric handler. */
  static element = CjsGraphTypeUint64;

  /** Stable class identity. */
  static className = "CjsGraphTypeBigUint64Array";

}
