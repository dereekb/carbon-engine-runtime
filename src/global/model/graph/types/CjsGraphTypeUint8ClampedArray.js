import { CjsGraphTypeArray } from "./CjsGraphTypeArray.js";
import { CjsGraphTypeUint8 } from "./CjsGraphTypeUint8.js";

/**
 * Uint8ClampedArray storage definition using shared typed-array operations.
 * Modelled on: Be::Var array storage family (blueexposure/include/BlueTypes.h:234-236).
 * @cjs Additional JS typed storage; equality is exact element comparison, not native Blue dispatch.
 */
export class CjsGraphTypeUint8ClampedArray extends CjsGraphTypeArray
{

  /** Definition name. */
  name = "Uint8ClampedArray";

  /**
   * Clamps and rounds ties to even, exactly as Uint8ClampedArray assignment.
   * @cjs ECMAScript storage.
   */
  static convert(value)
  {
    const number = +value;
    if (!(number > 0)) return 0;
    if (number >= 255) return 255;

    const lower = Math.floor(number);
    const fraction = number - lower;
    return fraction > 0.5 || (fraction === 0.5 && (lower & 1)) ? lower + 1 : lower;
  }

  /** Typed storage constructor. */
  static ctor = Uint8ClampedArray;

  /** Underlying unsigned-byte family; convert supplies clamping instead of wrapping. */
  static element = CjsGraphTypeUint8;

  /** Stable class identity. */
  static className = "CjsGraphTypeUint8ClampedArray";

}
