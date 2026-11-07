/** Converts to a member's integer width and sign. @cjs */
function convert(value, member)
{
  const shift = 32 - member.bits, shifted = value << shift;
  return member.signed ? shifted >> shift : shifted >>> shift;
}

/**
 * LONG, ULONG, BYTE and SHORT members: the width and sign are on the member.
 * Modelled on: Be::LONG/ULONG (blueexposure/BlueVariable.cpp:151-198).
 * @cjs Owner and key replace native pointers; BlueTypes.h:269-270 makes BYTE and SHORT unsigned,
 * and JS adds the signed widths.
 */
export class CjsGraphTypeLong
{

  /** Returns the stored value. @cjs */
  Get(holder, key)
  {
    return holder[key];
  }

  /** Writes unless the converted value is unchanged; returns whether it wrote. @cjs */
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

  /** Tests whether two values are the same integer at this width. @cjs */
  IsEqual(a, b, member)
  {
    return convert(a, member) === convert(b, member);
  }

  /**
   * Tests whether Set has nothing to do: IsEqual, except that a stored null is always overwritten.
   * @cjs
   */
  IsUnchanged(stored, value, member)
  {
    return stored !== null && this.IsEqual(stored, value, member);
  }

  /** Tests whether two values are the same integer at this width. @cjs */
  IsExactEqual(a, b, member)
  {
    return convert(a, member) === convert(b, member);
  }

  /** Tests valid input: an integer this width holds. @cjs */
  IsValidValue(value, member)
  {
    return typeof value === "number" && Number.isInteger(value) && value === convert(value, member);
  }

  /** Stable class identity. */
  static className = "CjsGraphTypeLong";

}
