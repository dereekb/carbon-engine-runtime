/** The entries of a Map or a plain bag. @cjs */
function getEntries(value)
{
  return value instanceof Map ? Array.from(value) : Object.entries(value);
}

/**
 * A member that holds a Map of plain values: the item type is on the member.
 * Modelled on: BlueDict's plain values (blue/src/DictReader.cpp ReadDict).
 * @cjs A bag's keys are strings, so a Map's keys are written as strings.
 */
export class CjsGraphTypeValuesMap
{

  /**
   * Returns a bag of plain values.
   * @cjs
   */
  Get(target, key, member, options)
  {
    const { item } = member, values = {}, slot = { value: null }; // alloc: the returned bag.

    for (const [ name, stored ] of target[key])
    {
      slot.value = stored;
      values[String(name)] = stored === null ? null : item.handler.Get(slot, "value", item, options);
    }

    return values;
  }

  /**
   * Replaces the Map's contents unless they are unchanged; returns whether it wrote.
   * @cjs
   */
  Set(target, key, value, member, options)
  {
    if (this.IsUnchanged(target[key], value, member)) return false;

    this.Write(target, key, value, member, options);
    return true;
  }

  /**
   * Stores a value with no comparison, keeping the Map object.
   * @cjs
   */
  Write(target, key, value, member, options)
  {
    const { item } = member, map = target[key] ??= new Map(); // alloc: a member holding no Map gets one.
    const entries = getEntries(value), slot = { value: null };

    map.clear();

    for (const [ name, entry ] of entries)
    {
      slot.value = null;
      if (entry !== null) item.handler.Write(slot, "value", entry, item, options);
      map.set(name, slot.value);
    }
  }

  /** Tests whether two Maps hold equal values under the same keys. @cjs */
  IsEqual(stored, value, member)
  {
    return this._isSame(stored, value, member, "IsEqual");
  }

  /** Tests whether Set has nothing to do. @cjs */
  IsUnchanged(stored, value, member)
  {
    return stored !== null && this._isSame(stored, value, member, "IsEqual");
  }

  /** Tests whether two Maps hold exactly equal values under the same keys. @cjs */
  IsExactEqual(stored, value, member)
  {
    return this._isSame(stored, value, member, "IsExactEqual");
  }

  /** Tests valid input: a Map or a bag of valid items. @cjs */
  IsValidValue(value, member)
  {
    if (!(value instanceof Map) && (typeof value !== "object" || Array.isArray(value) || ArrayBuffer.isView(value))) return false;

    const { item } = member;
    for (const [ , entry ] of getEntries(value))
    {
      if (entry !== null && !item.handler.IsValidValue(entry, item)) return false;
    }

    return true;
  }

  /** Compares entries through the item's handler. @cjs */
  _isSame(stored, value, member, comparison)
  {
    const { item } = member, entries = getEntries(value);
    if (stored.size !== entries.length) return false;

    for (const [ name, entry ] of entries)
    {
      if (!stored.has(name)) return false;

      const held = stored.get(name);
      if (held === null || entry === null)
      {
        if (held !== entry) return false;
      }
      else if (!item.handler[comparison](held, entry, item)) return false;
    }

    return true;
  }

  /** Stable class identity. */
  static className = "CjsGraphTypeValuesMap";

}
