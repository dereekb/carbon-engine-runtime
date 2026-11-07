/**
 * Operations for a member that holds a plain array of leaf values, such as matrices or strings.
 *
 * This is a type handler, not a trait or a new Carbon VARTYPE. One instance is shared by every
 * member with the same item handler, which supplies each element's conversion and comparison.
 *
 * @cjs No single Carbon donor: a JS array of values, where object lists use CjsGraphTypeList.
 */
export class CjsGraphTypeValues
{



  /**
   * Returns a plain array of element values; a null element stays null.
   * @cjs
   */
  Get(target, key, member, options)
  {
    const list = target[key], item = member.item;
    const values = new Array(list.length); // alloc: the returned plain array.

    for (let i = 0; i < list.length; i++)
    {
      values[i] = list[i] === null ? null : item.handler.Get(list, i, item, options);
    }

    return values;
  }

  /**
   * Writes each element through its handler, keeping the array and any element storage.
   * @cjs A missing element holds null until its handler writes it.
   */
  Set(target, key, value, member, options)
  {
    const list = target[key] ??= [], item = member.item; // alloc: a member holding no array gets one.
    let changed = list.length !== value.length;

    for (let i = 0; i < value.length; i++)
    {
      if (i >= list.length) list[i] = null;

      if (value[i] === null)
      {
        if (list[i] !== null) changed = true;
        list[i] = null;
      }
      else if (item.handler.Set(list, i, value[i], item, options)) changed = true;
    }

    list.length = value.length;
    return changed;
  }

  /**
   * Writes every element with no comparison.
   * @cjs
   */
  Write(target, key, value, member, options)
  {
    const list = target[key] ??= [], item = member.item; // alloc: a member holding no array gets one.

    for (let i = 0; i < value.length; i++)
    {
      if (i >= list.length || value[i] === null) list[i] = null;
      if (value[i] !== null) item.handler.Write(list, i, value[i], item, options);
    }

    list.length = value.length;
  }

  /**
   * Tests exact equality with no tolerance, element by element.
   * @cjs
   */
  IsExactEqual(stored, value, member)
  {
    const item = member.item;

    if (stored.length !== value.length) return false;

    for (let i = 0; i < value.length; i++)
    {
      if (stored[i] === null || value[i] === null)
      {
        if (stored[i] !== value[i]) return false;
      }
      else if (!item.handler.IsExactEqual(stored[i], value[i], item)) return false;
    }

    return true;
  }

  /**
   * Tests valid input: a plain array of null or valid elements.
   * @cjs
   */
  IsValidValue(value, member)
  {
    if (!Array.isArray(value)) return false;

    const item = member.item;

    for (let i = 0; i < value.length; i++)
    {
      if (value[i] !== null && !item.handler.IsValidValue(value[i], item)) return false;
    }

    return true;
  }

  /**
   * Whether Set has nothing to do.
   * @cjs
   */
  IsUnchanged(stored, value, member)
  {
    const item = member.item;

    if (stored.length !== value.length) return false;

    for (let i = 0; i < value.length; i++)
    {
      if (stored[i] === null || value[i] === null)
      {
        if (stored[i] !== value[i]) return false;
      }
      else if (!item.handler.IsUnchanged(stored[i], value[i], item)) return false;
    }

    return true;
  }

  /** Stable class identity. */
  static className = "CjsGraphTypeValues";

}
