import { CjsGraphTypeScalar } from "./CjsGraphTypeScalar.js";

/**
 * Shared typed-array operations on caller-owned storage.
 * Modelled on: Be::FLOATARRAY/DOUBLEARRAY/INTARRAY Copy (blueexposure/BlueVariable.cpp:771-815).
 * @cjs JS constructors and element handlers replace native buffer types. Fixed-size storage
 * must exist; only variable-length resizing and explicit Clone allocate typed arrays.
 * No metadata lookup, per-call scratch array or per-property handler allocation is needed.
 */
export class CjsGraphTypeArray extends CjsGraphTypeScalar
{

  /** Definition name. */
  name = "Array";

  /** Storage constructor supplied by the concrete handler. */
  ctor = this.constructor.ctor;

  /** Variable length unless the property supplies a fixed count. */
  length = this.constructor.defaultLength;

  /**
   * Returns an independent plain values array.
   * @cjs BigInt elements remain BigInt, not JSON strings.
   */
  static get(target, key, options)
  {
    return Array.from(target[key]);
  }

  /**
   * Converts one element identically to the destination typed array.
   * @cjs Unary plus enforces Number-array conversion (including rejection of BigInt).
   * BigInt elements retain their native input conversion; Float64 scalar conversion alone accepts BigInt.
   */
  static convert(value, options)
  {
    return this.element.convert(this.element.ctor === Number ? +value : value, options);
  }

  /**
   * Writes only when converted storage differs; preserves fixed storage and overlapping views.
   * @cjs Native TypedArray.set performs the write. Concrete conversion must agree with it.
   */
  static set(target, key, value, options = {})
  {
    const length = options.length ?? this.defaultLength;
    const current = target[key];
    if (length !== -1 && (value.length !== length || current.length !== length))
    {
      throw new RangeError("Fixed-length array assignment requires matching source and destination lengths.");
    }

    if (current.length !== value.length)
    {
      target[key] = new this.ctor(value); // alloc: replacement owned storage only when variable length changes.
      return true;
    }

    let changed = false;
    for (let i = 0; i < value.length; i++)
    {
      if (!Object.is(current[i], this.convert(value[i], options)))
      {
        changed = true;
        break;
      }
    }
    if (changed) current.set(value);
    return changed;
  }

  /**
   * Creates an independently owned typed copy.
   * @cjs Explicit cloning allocation.
   */
  static clone(target, key, options)
  {
    return new this.ctor(target[key]); // alloc: explicit independent copy owned by the caller.
  }

  /**
   * Checks typed storage across realms and a named definition's fixed count.
   * @cjs Excludes plain arrays and DataView; variable-length definitions accept any count.
   */
  static is(value)
  {
    return ArrayBuffer.isView(value)
      && Object.prototype.toString.call(value) === `[object ${this.ctor.name}]`
      && (this.defaultLength === -1 || value.length === this.defaultLength);
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
    if (!this.hasValueEquality || !this.is(a) || !this.is(b) || a.length !== b.length) return false;
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
  static isLike(a, b, options = {})
  {
    const length = options.length ?? this.defaultLength;
    if (!this.hasValueEquality || a.length !== b.length || (length !== -1 && a.length !== length)) return false;
    for (let i = 0; i < a.length; i++)
    {
      if (!this.equalElement(this.convert(a[i], options), this.convert(b[i], options))) return false;
    }
    return true;
  }

  /** Concrete storage constructor; the base itself is not a storage definition. */
  static ctor = null;

  /** Concrete scalar element handler. */
  static element = null;

  /** Default declared count; semantic math definitions override it. */
  static defaultLength = -1;

  /** Carbon DOUBLEARRAY/INTARRAY lack AreEqual specialisations; their definitions disable it. */
  static hasValueEquality = true;

  /** Stable class identity. */
  static className = "CjsGraphTypeArray";

}
