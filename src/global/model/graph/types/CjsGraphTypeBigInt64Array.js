import { CjsGraphTypeArray } from "./CjsGraphTypeArray.js";
import { CjsGraphTypeInt64 } from "./CjsGraphTypeInt64.js";

/**
 * BigInt64Array storage definition using shared typed-array operations.
 * Modelled on: Be::Var array storage family (blueexposure/include/BlueTypes.h:234-236).
 * @cjs Additional JS typed storage; equality is exact element comparison, not native Blue dispatch.
 */
export class CjsGraphTypeBigInt64Array extends CjsGraphTypeArray
{

  /** Definition name. */
  name = "BigInt64Array";

  /** Typed storage constructor. */
  static ctor = BigInt64Array;

  /** Scalar conversion shared with the numeric handler. */
  static element = CjsGraphTypeInt64;

  /** Stable class identity. */
  static className = "CjsGraphTypeBigInt64Array";

}
