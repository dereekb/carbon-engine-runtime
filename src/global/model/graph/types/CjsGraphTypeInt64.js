/** Whether a value is one of a raw [high, low] pair of 32-bit words. @cjs */
function isWord(value)
{
  return Number.isInteger(value) && value >= -0x80000000 && value <= 0xFFFFFFFF;
}

/** Converts to storage: a safe integer stays a Number, and the rest are BigInt. @cjs */
function convert(value, member)
{
  if (Number.isSafeInteger(value)) return value;

  const bits = Array.isArray(value)
    ? (BigInt.asUintN(32, BigInt(value[0])) << 32n) | BigInt.asUintN(32, BigInt(value[1]))
    : value;

  return member.signed ? BigInt.asIntN(64, bits) : BigInt.asUintN(64, bits);
}

/** Whether a BigInt is already in range. @cjs */
function isStored(value, member)
{
  return typeof value === "bigint" && value === convert(value, member);
}

/**
 * INT64 and UINT64 members, as BigInt or a safe integer: the sign is on the member.
 * Modelled on: Be::INT64 (blueexposure/BlueVariable.cpp).
 * @cjs Readers hand over safe integers as Numbers, so both forms hold.
 */
export class CjsGraphTypeInt64
{

  /** Returns the stored value. @cjs */
  Get(holder, key)
  {
    return holder[key];
  }

  /** Writes unless the value is unchanged; returns whether it wrote. @cjs */
  Set(holder, key, value, member)
  {
    if (this.IsUnchanged(holder[key], value, member)) return false;

    holder[key] = convert(value, member);
    return true;
  }

  /** Stores a value with no comparison. @cjs */
  Write(holder, key, value, member)
  {
    holder[key] = convert(value, member);
  }

  /** Tests whether two values are the same integer. @cjs */
  IsEqual(a, b, member)
  {
    return this.IsExactEqual(a, b, member);
  }

  /**
   * Tests whether Set has nothing to do: IsEqual, except that a stored null is always overwritten.
   * @cjs
   */
  IsUnchanged(stored, value, member)
  {
    return stored !== null && this.IsEqual(stored, value, member);
  }

  /** Tests whether two values are the same integer. @cjs */
  IsExactEqual(a, b, member)
  {
    return BigInt(convert(a, member)) === BigInt(convert(b, member));
  }

  /** Tests valid input: a safe integer, an integer string, a pair of words or a BigInt in range. @cjs */
  IsValidValue(value, member)
  {
    if (typeof value === "number") return Number.isSafeInteger(value) && value === Number(convert(BigInt(value), member));
    if (typeof value === "string") return /^-?\d+$/u.test(value) && isStored(BigInt(value), member);
    if (Array.isArray(value)) return value.length === 2 && isWord(value[0]) && isWord(value[1]);

    return isStored(value, member);
  }

  /** Stable class identity. */
  static className = "CjsGraphTypeInt64";

}
