import { CjsGraphTypeArray } from "./CjsGraphTypeArray.js";
import { CjsGraphTypeUint32 } from "./CjsGraphTypeUint32.js";

/**
 * Uint32Array storage definition using shared typed-array operations.
 * Modelled on: Be::Var array storage family (blueexposure/include/BlueTypes.h:234-236).
 * @cjs Additional JS typed storage; equality is exact element comparison, not native Blue dispatch.
 */
export class CjsGraphTypeUint32Array extends CjsGraphTypeArray
{

  /** Definition name. */
  name = "Uint32Array";

  /** Typed storage constructor. */
  static ctor = Uint32Array;

  /** Scalar conversion shared with the numeric handler. */
  static element = CjsGraphTypeUint32;

  /** Stable class identity. */
  static className = "CjsGraphTypeUint32Array";

}
