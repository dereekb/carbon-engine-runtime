/**
 * INTARRAY members and the typed integer arrays: the array class, width and sign are on the member.
 * Modelled on: Be::INTARRAY (blueexposure/BlueVariable.cpp:804-815).
 * @cjs Storage converts on write, so a clamped array clamps. Carbon has no AreEqual for it, and
 * that gap does not apply: it compares as its elements do (operator, 2026-11-07).
 */
export class CjsGraphTypeIntArray
{

  /**
   * Returns an independent plain array.
   * @cjs A sized loop: Array.from cost 38% of get on real files.
   */
  Get(holder, key, member)
  {
    const storage = holder[key], count = storage.length, values = new Array(count); // alloc: the returned array.

    for (let i = 0; i < count; i++) values[i] = storage[i];

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
      storage = new member.ctor(count); // alloc: owned storage only when none is held or a length changes.
      holder[key] = storage;
    }

    if (!Array.isArray(value))
    {
      storage.set(value);
      return;
    }

    for (let i = 0; i < count; i++) storage[i] = +value[i];
  }

  /** Tests whether two arrays hold the same integers. @cjs */
  IsEqual(a, b)
  {
    return this.IsExactEqual(a, b);
  }

  /** Tests whether Set has nothing to do. @cjs */
  IsUnchanged(stored, value)
  {
    return stored !== null && this.IsExactEqual(stored, value);
  }

  /** Tests whether two arrays hold the same integers. @cjs */
  IsExactEqual(a, b)
  {
    const count = a.length;
    if (count !== b.length) return false;

    for (let i = 0; i < count; i++)
    {
      if (+a[i] !== +b[i]) return false;
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
      if (typeof item !== "number" || !Number.isInteger(item)) return false;
    }

    return true;
  }

  /** Stable class identity. */
  static className = "CjsGraphTypeIntArray";

}
