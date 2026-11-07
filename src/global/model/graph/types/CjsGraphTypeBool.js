/**
 * BOOL members.
 * Modelled on: Be::BOOL (blueexposure/BlueVariable.cpp).
 * @cjs Owner and key replace native pointers.
 */
export class CjsGraphTypeBool
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

    holder[key] = Boolean(value);
    return true;
  }

  /** Stores a value with no comparison. @cjs */
  Write(holder, key, value)
  {
    holder[key] = Boolean(value);
  }

  /** Tests whether two values are the same truth. @cjs */
  IsEqual(a, b)
  {
    return Boolean(a) === Boolean(b);
  }

  /**
   * Tests whether Set has nothing to do: IsEqual, except that a stored null is always overwritten.
   * @cjs
   */
  IsUnchanged(stored, value, member)
  {
    return stored !== null && this.IsEqual(stored, value, member);
  }

  /** Tests whether two values are the same truth. @cjs */
  IsExactEqual(a, b)
  {
    return Boolean(a) === Boolean(b);
  }

  /** Tests valid input. @cjs */
  IsValidValue(value)
  {
    return typeof value === "boolean";
  }

  /** Stable class identity. */
  static className = "CjsGraphTypeBool";

}
