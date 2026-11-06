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
   * Assigns unless IsEqual says the values are equal, which is what "changed" means here.
   * @cjs Change reporting. A null holds no value to compare, so anything replaces it.
   */
  static set(target, key, value)
  {
    const stored = target[key];
    if (stored !== null && this.isEqual(stored, value)) return false;

    target[key] = this.convert(value);
    return true;
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
   * NaN equals NaN, and signed zeros differ.
   * @cjs JavaScript comparison after conversion.
   */
  static isExactEqual(a, b)
  {
    return Object.is(this.convert(a), this.convert(b));
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
