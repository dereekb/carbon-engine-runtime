import { CjsGraphTypeScalar } from "./CjsGraphTypeScalar.js";

/**
 * Shared typed-array operations on caller-owned storage.
 * Modelled on: Be::FLOATARRAY/DOUBLEARRAY/INTARRAY Copy (blueexposure/BlueVariable.cpp:771-815).
 * @cjs JS constructors and element handlers replace native buffer types. A fixed size is its
 * own definition, and values are assumed valid here: IsValidValue and the conversion entry validate.
 * Fixed-size storage must exist; only variable-length resizing and explicit Clone allocate.
 */
export class CjsGraphTypeArray extends CjsGraphTypeScalar
{

  /** Definition name. */
  name = "Array";

  /** Storage constructor supplied by the concrete handler. */
  ctor = this.constructor.ctor;

  /**
   * Returns an independent plain values array.
   * @cjs BigInt elements remain BigInt, not JSON strings.
   */
  static get(target, key)
  {
    return Array.from(target[key]);
  }

  /**
   * Converts one element identically to the destination typed array.
   * @cjs Unary plus enforces Number-array conversion (including rejection of BigInt).
   * BigInt elements retain their native input conversion; Float64 scalar conversion alone accepts BigInt.
   */
  static convert(value)
  {
    return this.element.convert(this.element.ctor === Number ? +value : value);
  }

  /**
   * Writes unless the stored values are unchanged; preserves fixed storage and overlapping views.
   * @cjs Native TypedArray.set writes a typed source, which may overlap storage. A plain source
   * cannot, and writes through convert, which also takes forms native set refuses.
   */
  static set(target, key, value)
  {
    const current = target[key];
    const count = this.elementCount || value.length;

    if (current === null || (this.elementCount === 0 && current.length !== count))
    {
      const storage = new this.ctor(count); // alloc: owned storage only when none is held or a variable length changes.
      this._write(storage, value);
      target[key] = storage;
      return true;
    }

    if (this.isUnchanged(current, value)) return false;

    this._write(current, value);
    return true;
  }

  /** Writes a source into storage. @cjs */
  static _write(storage, value)
  {
    if (!Array.isArray(value))
    {
      storage.set(value);
      return;
    }

    for (let i = 0; i < value.length; i++) storage[i] = this.convert(value[i]);
  }

  /**
   * Creates an independently owned typed copy.
   * @cjs Explicit cloning allocation.
   */
  static clone(target, key)
  {
    return new this.ctor(target[key]); // alloc: explicit independent copy owned by the caller.
  }

  /**
   * Tests valid input: a plain or typed array of the right count and valid elements.
   * @cjs Excludes DataView; variable-length definitions accept any count.
   */
  static isValidValue(value)
  {
    if (!Array.isArray(value) && !(ArrayBuffer.isView(value) && value.length !== undefined)) return false;
    if (this.elementCount !== 0 && value.length !== this.elementCount) return false;

    for (let i = 0; i < value.length; i++)
    {
      if (!this._isElement(value[i])) return false;
    }

    return true;
  }

  /** Tests one input element. @cjs */
  static _isElement(value)
  {
    return this.element.isValidValue(value);
  }

  /**
   * Tests whether two arrays are exactly equal, with no tolerance, in any accepted form.
   * NaN equals NaN, and signed zeros differ.
   * @cjs JavaScript comparison after conversion.
   */
  static isExactEqual(a, b)
  {
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++)
    {
      if (!Object.is(this.convert(a[i]), this.convert(b[i]))) return false;
    }

    return true;
  }

  /**
   * Compares one converted element; Float32 arrays keep Carbon's separate tolerant rule.
   * @cjs Other families use their element's own comparison.
   */
  static equalElement(a, b)
  {
    return this.element.isEqual(a, b);
  }

  /**
   * Tests whether two arrays are equal in any accepted form, within Carbon's tolerance
   * where Carbon has one. This decides whether Set has anything to do.
   * @cjs Every family compares here. Carbon's DOUBLEARRAY and INTARRAY have no AreEqual, and
   * that gap does not apply: they compare as their elements do.
   */
  static isEqual(a, b)
  {
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++)
    {
      if (!this.equalElement(this.convert(a[i]), this.convert(b[i]))) return false;
    }

    return true;
  }

  /** Concrete storage constructor; the base itself is not a storage definition. */
  static ctor = null;

  /** Concrete scalar element handler. */
  static element = null;

  /** Fixed element count, set by each fixed definition; 0 means any length. */
  static elementCount = 0;

  /** Stable class identity. */
  static className = "CjsGraphTypeArray";

}
