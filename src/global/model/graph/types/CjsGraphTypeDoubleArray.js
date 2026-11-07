const TOLERANCE = 1e-12;

/**
 * DOUBLEARRAY members.
 * Modelled on: Be::DOUBLEARRAY (blueexposure/BlueVariable.cpp:791-803).
 * @cjs Float64Array storage. Carbon has no AreEqual for it, and that gap does not apply: it
 * compares as its elements do (operator, 2026-11-07).
 */
export class CjsGraphTypeDoubleArray
{

  /**
   * Returns an independent plain array.
   * @cjs A sized loop: Array.from cost 38% of get on real files.
   */
  Get(holder, key, member)
  {
    const storage = holder[key], count = storage.length, values = new Array(count); // alloc: the returned array.
    let finite = 0;

    for (let i = 0; i < count; i++)
    {
      const item = storage[i];
      values[i] = item;
      finite += item - item;
    }

    if (finite !== 0) throw new TypeError(`Non-finite number in graph member: ${member.name}`);

    return values;
  }

  /** Writes unless the stored values are unchanged; returns whether it wrote. @cjs */
  Set(holder, key, value, member)
  {
    if (this.IsUnchanged(holder[key], value, member)) return false;

    this.Write(holder, key, value, member);
    return true;
  }

  /**
   * Stores a value with no comparison. Fixed storage is kept; only a missing or resized array allocates.
   * @cjs Native set writes a typed source, which may overlap storage.
   */
  Write(holder, key, value, member)
  {
    const count = member.length || value.length;
    let storage = holder[key];

    if (storage === null || (member.length === 0 && storage.length !== count))
    {
      storage = new Float64Array(count); // alloc: owned storage only when none is held or a length changes.
      holder[key] = storage;
    }

    if (!Array.isArray(value))
    {
      storage.set(value);
      return;
    }

    for (let i = 0; i < count; i++) storage[i] = +value[i];
  }

  /** Tests whether two arrays are equal within the element tolerance. @cjs */
  IsEqual(a, b)
  {
    const count = a.length;
    if (count !== b.length) return false;

    for (let i = 0; i < count; i++)
    {
      if (Math.abs(+a[i] - +b[i]) >= TOLERANCE) return false;
    }

    return true;
  }

  /** Tests whether Set has nothing to do. @cjs */
  IsUnchanged(stored, value)
  {
    if (stored === null) return false;

    const count = stored.length;
    if (count !== value.length) return false;

    for (let i = 0; i < count; i++)
    {
      const item = stored[i];
      if (item !== item || Math.abs(item - +value[i]) >= TOLERANCE) return false;
    }

    return true;
  }

  /** Tests whether two arrays are exactly equal: -0 and 0 are one value. @cjs */
  IsExactEqual(a, b)
  {
    const count = a.length;
    if (count !== b.length) return false;

    for (let i = 0; i < count; i++)
    {
      const x = +a[i], y = +b[i];
      if (x !== y && (x === x || y === y)) return false;
    }

    return true;
  }

  /** Tests valid input: a plain or typed array of the member's length, of valid elements. @cjs */
  IsValidValue(value, member)
  {
    if (!Array.isArray(value) && !(ArrayBuffer.isView(value) && value.length !== undefined)) return false;

    const count = value.length;
    if (member.length !== 0 && count !== member.length) return false;

    for (let i = 0; i < count; i++)
    {
      const item = value[i];
      if (typeof item !== "number" || item - item !== 0) return false;
    }

    return true;
  }

  /** Stable class identity. */
  static className = "CjsGraphTypeDoubleArray";

}
