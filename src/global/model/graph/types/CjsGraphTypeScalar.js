/**
 * Shared JavaScript scalar value operations for the standalone type handlers.
 *
 * @cjs Owner/key access replaces native pointers. Set and Copy report an exact
 * stored-value change, not Carbon Copy's success result. No schema lookup or
 * input validation occurs during assignment; Is is a separate operation.
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
   * Assigns only when the converted value differs, including signed zero.
   * @cjs Change reporting.
   */
  static set(target, key, value)
  {
    const converted = this.convert(value);
    if (this.isExactEqual(target[key], converted)) return false;

    target[key] = converted;
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
   * Tests exact stored-value equality; NaN equals NaN, signed zeros differ.
   * @cjs JavaScript storage comparison.
   */
  static isExactEqual(a, b)
  {
    return Object.is(a, b);
  }

  /**
   * Compares scalar values; numeric specialisations supply Carbon tolerances.
   * @cjs Shared default.
   */
  static isEqual(a, b)
  {
    return a === b;
  }

  /**
   * Tests valid input: can this value be used to set this thing.
   * @cjs The unspecialised handler accepts nothing. The graph operation calls it; Set does not.
   */
  static is(value)
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
   * Instance shortcut to is.
   * @cjs
   */
  Is(value)
  {
    return this.constructor.is(value);
  }

  /**
   * Compares accepted representations after storage conversion.
   * @cjs Same conversion as Set; no schema or format rules are consulted.
   */
  static isLike(a, b)
  {
    return this.isEqual(this.convert(a), this.convert(b));
  }

  /**
   * Instance shortcut to isLike.
   * @cjs
   */
  IsLike(a, b, options)
  {
    return this.constructor.isLike(a, b, options);
  }

  /** Stable class identity. */
  static className = "CjsGraphTypeScalar";

}
