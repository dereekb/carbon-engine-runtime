import { CjsGraphTypeNumber } from "./CjsGraphTypeNumber.js";

/**
 * Shared exact 64-bit signed/unsigned integer operations.
 * Carbon: Be::INT64/UINT64 (blueexposure/BlueVariable.cpp:504-582).
 * @adapted BigInt replaces native integers. Conversion follows JS BigInt typed storage:
 * bigint, integer strings and booleans are accepted; Number inputs throw rather than
 * silently carrying already-rounded 64-bit values. This is not the legacy values codec.
 */
export class CjsGraphTypeBigInt extends CjsGraphTypeNumber
{

  /** Definition name. */
  name = "BigInt";

  /**
   * Wraps to the declared width without an intermediate Number.
   * @adapted Native BigInt conversion.
   */
  static convert(value)
  {
    return this.signed ? BigInt.asIntN(64, value) : BigInt.asUintN(64, value);
  }

  /**
   * Tests canonical BigInt values in the storage range.
   * @cjs Explicit representation query.
   */
  static is(value)
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
