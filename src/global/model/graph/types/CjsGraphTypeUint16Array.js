import { CjsGraphTypeArray } from "./CjsGraphTypeArray.js";
import { CjsGraphTypeUint16 } from "./CjsGraphTypeUint16.js";

/**
 * Uint16Array storage definition using shared typed-array operations.
 * Modelled on: Be::Var array storage family (blueexposure/include/BlueTypes.h:234-236).
 * @cjs Additional JS typed storage; equality is exact element comparison, not native Blue dispatch.
 */
export class CjsGraphTypeUint16Array extends CjsGraphTypeArray
{

  /** Definition name. */
  name = "Uint16Array";

  /** Typed storage constructor. */
  static ctor = Uint16Array;

  /** Scalar conversion shared with the numeric handler. */
  static element = CjsGraphTypeUint16;

  /** Stable class identity. */
  static className = "CjsGraphTypeUint16Array";

}
