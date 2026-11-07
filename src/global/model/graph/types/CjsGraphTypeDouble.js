const TOLERANCE = 1e-12;

/**
 * DOUBLE members.
 * Modelled on: Be::DOUBLE (blueexposure/BlueVariable.cpp:222-244).
 * @cjs Owner and key replace native pointers, and a number refuses NaN and Infinity.
 */
export class CjsGraphTypeDouble
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

    holder[key] = Number(value);
    return true;
  }

  /** Stores a value with no comparison. @cjs */
  Write(holder, key, value)
  {
    holder[key] = Number(value);
  }

  /** Tests whether two values are equal within Carbon's tolerance. @cjs */
  IsEqual(a, b)
  {
    return Math.abs(Number(a) - Number(b)) < TOLERANCE;
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
    const x = Number(a), y = Number(b);
    return x === y || (x !== x && y !== y);
  }

  /** Tests valid input: a finite number. @cjs */
  IsValidValue(value)
  {
    return typeof value === "number" && value - value === 0;
  }

  /** Stable class identity. */
  static className = "CjsGraphTypeDouble";

}
