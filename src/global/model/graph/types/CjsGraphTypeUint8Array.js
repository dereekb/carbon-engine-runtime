import { CjsGraphTypeArray } from "./CjsGraphTypeArray.js";
import { CjsGraphTypeUint8 } from "./CjsGraphTypeUint8.js";

/**
 * Uint8Array storage definition using shared typed-array operations.
 * Modelled on: Be::Var array storage family (blueexposure/include/BlueTypes.h:234-236).
 * @cjs Additional JS typed storage; equality is exact element comparison, not native Blue dispatch.
 */
export class CjsGraphTypeUint8Array extends CjsGraphTypeArray
{

  /** Definition name. */
  name = "Uint8Array";

  /** Typed storage constructor. */
  static ctor = Uint8Array;

  /** Scalar conversion shared with the numeric handler. */
  static element = CjsGraphTypeUint8;

  /** Stable class identity. */
  static className = "CjsGraphTypeUint8Array";

}
