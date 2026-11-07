/** The text before the first NUL. @cjs */
function convert(value)
{
  const text = String(value);
  const end = text.indexOf("\0");
  return end < 0 ? text : text.slice(0, end);
}

/**
 * CSTRING, WCSTRING, REFERENCE, WREFERENCE and the shared strings: text up to its first NUL.
 * Modelled on: Be::CSTRING (blueexposure/BlueVariable.cpp).
 * @cjs Native interning is plain JS string equality.
 */
export class CjsGraphTypeCString
{

  /** Returns the stored text up to its first NUL. @cjs */
  Get(holder, key)
  {
    return convert(holder[key]);
  }

  /** Writes unless the value is unchanged; returns whether it wrote. @cjs */
  Set(holder, key, value, member)
  {
    if (this.IsUnchanged(holder[key], value, member)) return false;

    holder[key] = convert(value);
    return true;
  }

  /** Stores a value with no comparison. @cjs */
  Write(holder, key, value)
  {
    holder[key] = convert(value);
  }

  /** Tests whether two values are the same text. @cjs */
  IsEqual(a, b)
  {
    return convert(a) === convert(b);
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
    return convert(a) === convert(b);
  }

  /** Tests valid input. @cjs */
  IsValidValue(value)
  {
    return typeof value === "string";
  }

  /** Stable class identity. */
  static className = "CjsGraphTypeCString";

}
