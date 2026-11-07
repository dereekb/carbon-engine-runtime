/**
 * STDSTRING and STDWSTRING members, and the path and expression names over them.
 * Modelled on: Be::STDSTRING (blueexposure/BlueVariable.cpp).
 * @cjs JS strings hold every width, and keep embedded NULs.
 */
export class CjsGraphTypeString
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

    holder[key] = String(value);
    return true;
  }

  /** Stores a value with no comparison. @cjs */
  Write(holder, key, value)
  {
    holder[key] = String(value);
  }

  /** Tests whether two values are the same text. @cjs */
  IsEqual(a, b)
  {
    return String(a) === String(b);
  }

  /**
   * Tests whether Set has nothing to do: IsEqual, except that a stored null is always overwritten.
   * @cjs
   */
  IsUnchanged(stored, value, member)
  {
    return stored !== null && this.IsEqual(stored, value, member);
  }

  /** Tests whether two values are the same text. @cjs */
  IsExactEqual(a, b)
  {
    return String(a) === String(b);
  }

  /** Tests valid input: text, which a path also checks. @cjs */
  IsValidValue(value, member)
  {
    return typeof value === "string" && (member.check === null || member.check(value));
  }

  /** Stable class identity. */
  static className = "CjsGraphTypeString";

}
