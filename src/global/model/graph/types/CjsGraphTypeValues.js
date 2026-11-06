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

  /** Definition name. */
  name = "Values";

  /** The leaf handler for one element. */
  item = null;

  /**
   * @param {object} item The leaf handler for one element.
   */
  constructor(item)
  {
    this.item = item;
  }

  /**
   * Returns a plain array of element values; a null element stays null.
   * @cjs
   */
  Get(target, key, options)
  {
    const list = target[key];
    const values = new Array(list.length); // alloc: the returned plain array.

    for (let i = 0; i < list.length; i++)
    {
      values[i] = list[i] === null ? null : this.item.Get(list, i, options);
    }

    return values;
  }

  /**
   * Writes each element through its handler, keeping the array and any element storage.
   * @cjs A missing element holds null until its handler writes it.
   */
  Set(target, key, value, options)
  {
    const list = target[key] ??= []; // alloc: a member holding no array gets one.
    let changed = list.length !== value.length;

    for (let i = 0; i < value.length; i++)
    {
      if (i >= list.length) list[i] = null;

      if (value[i] === null)
      {
        if (list[i] !== null) changed = true;
        list[i] = null;
      }
      else if (this.item.Set(list, i, value[i], options)) changed = true;
    }

    list.length = value.length;
    return changed;
  }

  /**
   * Tests valid input: a plain array of null or valid elements.
   * @cjs
   */
  IsValidValue(value)
  {
    if (!Array.isArray(value)) return false;

    for (let i = 0; i < value.length; i++)
    {
      if (value[i] !== null && !this.item.IsValidValue(value[i])) return false;
    }

    return true;
  }

  /**
   * Whether Set has nothing to do.
   * @cjs
   */
  IsUnchanged(stored, value)
  {
    if (stored.length !== value.length) return false;

    for (let i = 0; i < value.length; i++)
    {
      if (stored[i] === null || value[i] === null)
      {
        if (stored[i] !== value[i]) return false;
      }
      else if (!this.item.IsUnchanged(stored[i], value[i])) return false;
    }

    return true;
  }

  /** Stable class identity. */
  static className = "CjsGraphTypeValues";

}
