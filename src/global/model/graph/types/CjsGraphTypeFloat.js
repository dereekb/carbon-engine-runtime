const TOLERANCE = Math.fround(1e-6);

/**
 * FLOAT members.
 * Modelled on: Be::FLOAT (blueexposure/BlueVariable.cpp:200-222)
 * @cjs Owner and key replace native pointers, and a number refuses NaN and Infinity.
 */
export class CjsGraphTypeFloat
{

  /**
   * Returns the stored value.
   * @cjs A non-finite number here is a bug: readers replace them and Set refuses them.
   */
  Get(holder, key, member)
  {
    const stored = holder[key];
    if (stored - stored !== 0) throw new TypeError(`Non-finite number in graph member: ${member.name}`);

    return stored;
  }

  /**
   * Writes unless the value is equal within Carbon's tolerance; returns whether it wrote.
   * @cjs
   */
  Set(holder, key, value, member)
  {
    if (this.IsUnchanged(holder[key], value, member)) return false;

    holder[key] = Math.fround(value);
    return true;
  }

  /** Stores a value with no comparison. @cjs */
  Write(holder, key, value)
  {
    holder[key] = Math.fround(value);
  }

  /**
   * Tests whether two values are equal within Carbon's tolerance.
   * Modelled on: Be::FLOAT (blueexposure/BlueVariable.cpp:200-222).
   * @adapted JavaScript values replace native union members.
   */
  IsEqual(a, b)
  {
    return Math.abs(Math.fround(Math.fround(a) - Math.fround(b))) < TOLERANCE;
  }

  /**
   * Tests whether Set has nothing to do: IsEqual, except that a stored null is always overwritten.
   * @cjs
   */
  IsUnchanged(stored, value, member)
  {
    return stored !== null && this.IsEqual(stored, value, member);
  }

  /** Tests whether two values are exactly equal: -0 and 0 are one value. @cjs */
  IsExactEqual(a, b)
  {
    const x = Math.fround(a), y = Math.fround(b);
    return x === y || (x !== x && y !== y);
  }

  /** Tests valid input: a finite number. @cjs */
  IsValidValue(value)
  {
    return typeof value === "number" && value - value === 0;
  }

  /** Stable class identity. */
  static className = "CjsGraphTypeFloat";

}
