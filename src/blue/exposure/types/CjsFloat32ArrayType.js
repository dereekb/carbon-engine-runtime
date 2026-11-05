import { VARTYPE } from "../BlueTypes.js";
import { CjsScalarType } from "./CjsScalarType.js";
import { isTag } from "#utils/is";

/**
 * Float-array operations on caller-owned storage.
 * Modelled on: Be::FLOATARRAY (blueexposure/BlueVariable.cpp:735-778)
 * @cjs JS-owned arrays replace native member buffers. A positive declared
 * length fixes storage size; -1 permits resizing. No implicit lazy allocation
 * for fixed-length members: their owner must provide the declared storage.
 */
export class CjsFloat32ArrayType extends CjsScalarType
{
  /** Stable class identity. */
  static className = "CjsFloat32ArrayType";
  /** Definition name. */
  name = "Float32Array";
  /** Carbon storage identifier. */
  varType = VARTYPE.FLOATARRAY;
  /** Storage constructor. */
  ctor = Float32Array;
  /** Variable length unless the property supplies a fixed count. */
  length = -1;

  /** Returns an independent plain values array. @cjs Values-bag representation. */
  static get(target, key)
  {
    return Array.from(target[key]);
  }

  /**
   * Writes converted elements, retaining storage when its length matches.
   * Exact comparison happens before writing, so overlapping views are safe.
   * @cjs Changed storage is reported separately from tolerant Carbon equality.
   */
  static set(target, key, value, options)
  {
    const length = options?.length ?? -1;
    const current = target[key];
    if (length !== -1 && (value.length !== length || current.length !== length))
    {
      throw new RangeError("Fixed-length array assignment requires matching source and destination lengths.");
    }

    if (current.length !== value.length)
    {
      // Owned variable-length member allocation, never temporary scratch storage.
      target[key] = new Float32Array(value); // alloc: replacement owned storage only when variable length changes.
      return true;
    }

    let changed = false;
    for (let i = 0; i < value.length; i++)
    {
      if (!Object.is(current[i], Math.fround(value[i]))) { changed = true; break; }
    }
    if (changed) current.set(value);
    return changed;
  }

  /** Creates an independently owned copy, not a scratch buffer. @cjs Explicit cloning allocation. */
  static clone(target, key)
  {
    return new Float32Array(target[key]); // alloc: explicit independent copy owned by the caller.
  }

  /** Checks storage representation across realms. @cjs JavaScript representation query. */
  static is(value)
  {
    return isTag(value, "[object Float32Array]");
  }

  /** Compares elements as JS values, distinguishing signed zero. @cjs Exact change comparison. */
  static isExactEqual(a, b)
  {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
    return true;
  }

  /**
   * Carbon: IsArrayEqual (blueexposure/BlueVariable.cpp:39-50).
   * Preserves its NaN comparison quirk: a NaN difference does not reject a pair.
   * @adapted JS length check replaces the native member's single declared count.
   */
  static isEqual(a, b)
  {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++)
    {
      if (Math.abs(Math.fround(a[i] - b[i])) >= Math.fround(1e-6)) return false;
    }
    return true;
  }
}
