/**
 * Shared JavaScript scalar value operations for the standalone type handlers.
 *
 * @cjs Owner/key access replaces native pointers. Set and Copy report a change, not
 * Carbon Copy's success result. No schema lookup or input validation occurs during
 * assignment; IsValidValue is a separate operation. IsEqual and IsExactEqual compare
 * values in any accepted form, and assume both are valid.
 */
export class CjsGraphTypeScalar
{

  /** Definition name. */
  name = "Scalar";

  /**
   * Returns the stored value.
   * @cjs JavaScript property access.
   */
  static get(target, key)
  {
    return target[key];
  }

  /**
   * Converts to the handler's storage representation.
   * @cjs Identity for the base.
   */
  static convert(value)
  {
    return value;
  }

  /**
   * Assigns unless the stored value is unchanged by this input.
   * @cjs Change reporting.
   */
  static set(target, key, value)
  {
    if (this.isUnchanged(target[key], value)) return false;

    this.write(target, key, value);
    return true;
  }

  /**
   * Stores a value with no comparison, for skipEquality, a creation or a copy.
   * @cjs
   */
  static write(target, key, value)
  {
    target[key] = this.convert(value);
  }

  /**
   * Whether Set has nothing to do: IsEqual, except that nothing stored as null or NaN is kept.
   * @cjs Set's rule, not Carbon's comparison, which IsEqual keeps (CE-202).
   */
  static isUnchanged(stored, value)
  {
    return stored !== null && this.isEqual(stored, value);
  }

  /**
   * Copies through the destination conversion, returning whether it changed.
   * @cjs Change reporting.
   */
  static copy(source, sourceKey, target, key, options)
  {
    return this.set(target, key, source[sourceKey], options);
  }

  /**
   * Returns the immutable scalar value.
   * @cjs No storage allocation is required.
   */
  static clone(target, key)
  {
    return target[key];
  }

  /**
   * Tests whether two values are exactly equal, with no tolerance, in any accepted form.
   * NaN equals NaN, and -0 and 0 are the same value.
   * @cjs JavaScript comparison after conversion.
   */
  static isExactEqual(a, b)
  {
    const x = this.convert(a), y = this.convert(b);
    return x === y || (x !== x && y !== y);
  }

  /**
   * Tests whether two values are equal in any accepted form, within Carbon's tolerance
   * where Carbon has one. This decides whether Set has anything to do.
   * @cjs Exact by default; float specialisations supply Carbon's tolerance.
   */
  static isEqual(a, b)
  {
    return this.isExactEqual(a, b);
  }

  /**
   * Tests valid input: can this value be used to set this thing.
   * @cjs The unspecialised handler accepts nothing. The graph operation calls it; Set does not.
   */
  static isValidValue(value)
  {
    return false;
  }

  /**
   * Instance shortcut to get.
   * @cjs
   */
  Get(target, key, options)
  {
    return this.constructor.get(target, key, options);
  }

  /**
   * Instance shortcut to set.
   * @cjs
   */
  Set(target, key, value, options)
  {
    return this.constructor.set(target, key, value, options);
  }

  /**
   * Instance shortcut to write.
   * @cjs
   */
  Write(target, key, value, options)
  {
    this.constructor.write(target, key, value, options);
  }

  /**
   * Instance shortcut to copy.
   * @cjs
   */
  Copy(source, sourceKey, target, key, options)
  {
    return this.constructor.copy(source, sourceKey, target, key, options);
  }

  /**
   * Instance shortcut to clone.
   * @cjs
   */
  Clone(target, key, options)
  {
    return this.constructor.clone(target, key, options);
  }

  /**
   * Instance shortcut to isUnchanged.
   * @cjs
   */
  IsUnchanged(stored, value)
  {
    return this.constructor.isUnchanged(stored, value);
  }

  /**
   * Instance shortcut to isExactEqual.
   * @cjs
   */
  IsExactEqual(a, b)
  {
    return this.constructor.isExactEqual(a, b);
  }

  /**
   * Instance shortcut to isEqual.
   * @cjs
   */
  IsEqual(a, b)
  {
    return this.constructor.isEqual(a, b);
  }

  /**
   * Instance shortcut to isValidValue.
   * @cjs
   */
  IsValidValue(value)
  {
    return this.constructor.isValidValue(value);
  }

  /** Stable class identity. */
  static className = "CjsGraphTypeScalar";

}
