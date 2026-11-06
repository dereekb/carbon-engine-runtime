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
   * Writes only when converted storage differs; preserves fixed storage and overlapping views.
   * @cjs Native TypedArray.set writes a typed source, which may overlap storage. A plain source
   * cannot, and writes through convert, which also takes forms native set refuses.
   */
  static set(target, key, value)
  {
    const current = target[key];
    const count = this.elementCount || value.length;

    if (this.elementCount === 0 && current.length !== count)
    {
      const storage = new this.ctor(count); // alloc: replacement owned storage only when a variable length changes.
      this._write(storage, value, 0);
      target[key] = storage;
      return true;
    }

    for (let i = 0; i < count; i++)
    {
      if (!Object.is(current[i], this.convert(value[i])))
      {
        this._write(current, value, i);
        return true;
      }
    }

    return false;
  }

  /** Writes a source into storage from start. @cjs */
  static _write(storage, value, start)
  {
    if (!Array.isArray(value))
    {
      storage.set(value);
      return;
    }

    for (let i = start; i < value.length; i++) storage[i] = this.convert(value[i]);
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

  /** Tests this definition's own storage across realms, with its fixed count. @cjs */
  static _isStored(value)
  {
    return ArrayBuffer.isView(value)
      && Object.prototype.toString.call(value) === `[object ${this.ctor.name}]`
      && (this.elementCount === 0 || value.length === this.elementCount);
  }

  /**
   * Tests whether Set with this input would leave the stored elements unchanged.
   * @cjs The comparison Set makes, for callers comparing without writing.
   */
  static isExactLike(stored, value)
  {
    if (stored.length !== value.length) return false;

    for (let i = 0; i < value.length; i++)
    {
      if (!Object.is(stored[i], this.convert(value[i]))) return false;
    }

    return true;
  }

  /**
   * Compares elements exactly, distinguishing signed zero and treating NaN as equal.
   * @cjs
   */
  static isExactEqual(a, b)
  {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++)
    {
      if (!Object.is(a[i], b[i])) return false;
    }
    return true;
  }

  /**
   * Compares one stored element; Float32 arrays retain Carbon's separate tolerant rule.
   * @cjs Exact comparison for JS-only array families.
   */
  static equalElement(a, b)
  {
    return Object.is(a, b);
  }

  /**
   * Compares canonical arrays using the family's equality policy.
   * @cjs Native gaps stay explicit.
   */
  static isEqual(a, b)
  {
    if (!this.hasValueEquality || !this._isStored(a) || !this._isStored(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++)
    {
      if (!this.equalElement(a[i], b[i])) return false;
    }
    return true;
  }

  /**
   * Compares converted representations without allocating scratch arrays.
   * @cjs Same conversion as storage.
   */
  static isLike(a, b)
  {
    if (!this.hasValueEquality || a.length !== b.length) return false;

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

  /** Carbon DOUBLEARRAY/INTARRAY lack AreEqual specialisations; their definitions disable it. */
  static hasValueEquality = true;

  /** Stable class identity. */
  static className = "CjsGraphTypeArray";

}
