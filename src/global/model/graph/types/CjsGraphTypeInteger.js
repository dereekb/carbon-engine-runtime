import { CjsGraphTypeNumber } from "./CjsGraphTypeNumber.js";

/**
 * Shared signed/unsigned 8-, 16- and 32-bit integer conversion.
 * Carbon: Be::Var integer storage (blueexposure/include/BlueTypes.h:264-270).
 * @cjs Bitwise conversion supplies JS truncation/wrapping without scratch arrays.
 * Signed 8/16 storage extends the native BYTE/SHORT mappings, which are unsigned.
 */
export class CjsGraphTypeInteger extends CjsGraphTypeNumber
{

  /** Definition name. */
  name = "Integer";

  /**
   * Converts to the declared width; non-finite inputs become zero like JS integer storage.
   * @cjs
   */
  static convert(value)
  {
    const shift = 32 - this.bits;
    const shifted = value << shift;
    return this.signed ? shifted >> shift : shifted >>> shift;
  }

  /**
   * Tests integral values in the declared storage range.
   * @cjs Explicit representation query.
   */
  static isValidValue(value)
  {
    return typeof value === "number" && Number.isInteger(value) && value === this.convert(value);
  }

  /** Storage width; concrete types override it. */
  static bits = 32;

  /** Signedness; concrete types override it. */
  static signed = true;

  /** Stable class identity. */
  static className = "CjsGraphTypeInteger";

}
