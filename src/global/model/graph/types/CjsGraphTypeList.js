import { CjsGraph } from "../CjsGraph.js";

/**
 * Shared operations for a member that holds a list of objects.
 *
 * This is a type handler, not a trait or a new Carbon VARTYPE. It holds no graph logic:
 * CjsGraph walks each item, and this class is what the walk calls for such a member.
 *
 * @cjs No single Carbon donor: one handler for BlueList, plain arrays and structure lists.
 */
export class CjsGraphTypeList
{

  /** Definition name. */
  name = "List";

  /**
   * Returns a plain array of item values; a null item stays null.
   * Modelled on: YamlWriter's list rule (IRootWriter.WriteList).
   * @cjs The member is read once: nested items overwrite options.member.
   */
  static get(target, key, options)
  {
    const list = target[key];
    const type = options.member.edge.type;
    const values = new Array(list.length); // alloc: the returned plain array.

    for (let i = 0; i < list.length; i++)
    {
      values[i] = list[i] === null ? null : CjsGraph.getObject(list[i], type, options);
    }

    return values;
  }

  /**
   * Replaces the list's contents in place: objects stay, bags are new, the rest are removed.
   * A value that already matches the list is no change, and order counts: the same objects
   * in another order are a change. A null empties the list, keeping the list object.
   * Returns false, or the whole new contents as a plain array.
   * @cjs No positional matching of objects. Raw array writes bypass BlueList admission and
   * notification (BlueListUtil.h:206-210). An existing owner's list goes through the policy's
   * replaceList when it has one, which needs the old items still in place: the list is left
   * alone here, and the items wait, with any forward reference, for the end of the operation.
   */
  static set(target, key, value, options)
  {
    if (value === null && target[key] === null) return false;

    const source = value ?? [];
    const { member, owner } = options;
    const edge = member.edge;
    const list = target[key] ??= []; // alloc: a member holding no list gets one.

    if (source === list) return false;
    if (edge.kind === "embed") return this._setRows(list, source, edge.type, options);
    if (CjsGraph.isListLike(list, source, edge.type, options)) return false;

    const items = new Array(source.length); // alloc: the change record, and the new contents.
    const staged = options.staged && !options.creating;

    for (let i = 0; i < source.length; i++)
    {
      items[i] = this._getItem(source[i], staged ? items : list, i, items, edge.type, options);
    }

    if (staged)
    {
      options.listEdits.push({ owner, member, list, items });
      return items;
    }

    list.length = items.length;
    for (let i = 0; i < items.length; i++) list[i] = items[i];

    return items;
  }

  /**
   * Resolves one incoming item; a forward reference holds its slot with null.
   * @cjs
   */
  static _getItem(value, list, index, items, type, options)
  {
    if (value === null || !CjsGraph.isPlain(value)) return value;
    if (value._ref === undefined) return CjsGraph.createObject(value, type, options);

    const object = options.anchors.get(value._ref);
    if (object !== undefined) return object;

    CjsGraph.deferReference(list, index, value._ref, type, items, index, options);
    return null;
  }

  /**
   * Reads records into a structure list's rows.
   * Modelled on: Blue::DictReader::ReadStructureList.
   * @cjs Rows are values with no identity, so they do reuse their position. A _ref holds its
   * row and fills it once every source is read, so it counts as a change.
   */
  static _setRows(list, source, type, options)
  {
    let changed = list.length !== source.length;

    for (let i = 0; i < source.length; i++)
    {
      const held = i < list.length && list[i] !== null;

      if (CjsGraph.isReference(source[i]))
      {
        if (!held) list[i] = CjsGraph.createObject({}, type, options);
        CjsGraph.deferValues(list[i], source[i], type, options);
        changed = true;
        continue;
      }

      const values = CjsGraph.getEmbeddedValues(source[i], options);

      if (held)
      {
        if (CjsGraph.setObject(list[i], values, type, options) !== false) changed = true;
      }
      else
      {
        list[i] = CjsGraph.createObject(values, type, options);
        changed = true;
      }
    }

    list.length = source.length;
    return changed ? Array.from(list) : false;
  }

  /**
   * Tests valid input.
   * @cjs The graph operation calls it, and passes null around it.
   */
  static isValidValue(value)
  {
    return Array.isArray(value);
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
   * Instance shortcut to isValidValue.
   * @cjs
   */
  IsValidValue(value)
  {
    return this.constructor.isValidValue(value);
  }

  /** Stable class identity. */
  static className = "CjsGraphTypeList";

}
