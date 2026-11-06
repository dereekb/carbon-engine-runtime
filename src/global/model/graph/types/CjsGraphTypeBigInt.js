import { CjsGraphTypeNumber } from "./CjsGraphTypeNumber.js";

/**
 * Shared exact 64-bit signed/unsigned integer operations.
 * Carbon: Be::INT64/UINT64 (blueexposure/BlueVariable.cpp:504-582).
 * @adapted BigInt replaces native integers. Conversion follows JS BigInt typed storage:
 * bigint, integer strings and booleans are accepted. A safe-integer Number is stored as
 * given, matching what the Black reader stores today; any other Number throws rather than
 * silently carrying an already-rounded 64-bit value. A plain [high, low] pair of 32-bit
 * words is also accepted, because JSON numbers cannot carry a whole 64-bit value.
 * This is not the legacy values codec.
 */
export class CjsGraphTypeBigInt extends CjsGraphTypeNumber
{

  /** Definition name. */
  name = "BigInt";

  /**
   * Wraps to the declared width without an intermediate Number.
   * @adapted Native BigInt conversion. A [high, low] pair joins its two 32-bit words first.
   */
  static convert(value)
  {
    if (Number.isSafeInteger(value)) return value;

    const bits = Array.isArray(value)
      ? (BigInt.asUintN(32, BigInt(value[0])) << 32n) | BigInt.asUintN(32, BigInt(value[1]))
      : value;

    return this.signed ? BigInt.asIntN(64, bits) : BigInt.asUintN(64, bits);
  }

  /**
   * Tests valid input: a BigInt, a safe integer or an integer string in the storage range,
   * or a [high, low] pair.
   * @cjs Each word of a pair is a 32-bit pattern, so a pair is always in range.
   */
  static isValidValue(value)
  {
    if (typeof value === "number") return Number.isSafeInteger(value) && value === Number(this.convert(BigInt(value)));
    if (typeof value === "string") return /^-?\d+$/u.test(value) && this._isStored(BigInt(value));
    if (Array.isArray(value)) return value.length === 2 && this._isWord(value[0]) && this._isWord(value[1]);

    return this._isStored(value);
  }

  /** Tests one word of a pair: any signed or unsigned 32-bit integer. @cjs */
  static _isWord(value)
  {
    return Number.isInteger(value) && value >= -0x80000000 && value <= 0xFFFFFFFF;
  }

  /**
   * Tests exact equality across a stored Number and a BigInt, which hold the same value.
   * @cjs JavaScript's strict equality separates the two forms.
   */
  static isExactEqual(a, b)
  {
    return BigInt(this.convert(a)) === BigInt(this.convert(b));
  }

  /** Tests a canonical BigInt value in the storage range. @cjs */
  static _isStored(value)
  {
    return typeof value === "bigint" && value === this.convert(value);
  }

  /** Signedness; unsigned storage overrides it. */
  static signed = true;

  /** Canonical JavaScript primitive constructor. */
  static ctor = BigInt;

  /** Stable class identity. */
  static className = "CjsGraphTypeBigInt";

}
