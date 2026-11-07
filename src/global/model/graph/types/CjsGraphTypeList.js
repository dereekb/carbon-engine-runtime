import { CjsGraph } from "../CjsGraph.js";

/**
 * A member that holds a list of objects: BlueList, a plain array or a structure list.
 * @cjs No single Carbon donor. Holds no graph logic: CjsGraph walks each item, and this is what the
 * walk calls for such a member.
 */
export class CjsGraphTypeList
{

  /**
   * Returns a plain array of item values; a null item stays null.
   * Modelled on: YamlWriter's list rule (IRootWriter.WriteList).
   * @cjs
   */
  Get(target, key, member, options)
  {
    const list = target[key];
    const type = member.edgeType;
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
   * @cjs No positional matching of objects. A list that sends events waits for the end of the
   * operation, because they need the old items still in place. A list with neither is
   * written here, raw (BlueListUtil.h:206-210). A copy rebuilds unless both sides are empty.
   */
  Set(target, key, value, member, options)
  {
    if (value === null && target[key] === null) return false;

    const source = value ?? [];
    const { owner } = options;
    const type = member.edgeType;
    const list = target[key] ??= []; // alloc: a member holding no list gets one.

    if (source === list) return false;
    if (member.edgeKind === "embed") return this._setRows(list, source, type, options);
    if (list.length === 0 && source.length === 0 && !CjsGraph.isLoadingList(options)) return false;
    if (!CjsGraph.isWritingAll(options) && CjsGraph.isListLike(list, source, type, options)) return false;

    const items = new Array(source.length); // alloc: the change record, and the new contents.
    const staged = CjsGraph.isListStaged(list, owner, options);

    for (let i = 0; i < source.length; i++)
    {
      items[i] = this._getItem(source[i], staged ? items : list, i, items, type, options);
    }

    if (staged)
    {
      options.listEdits.push({ owner, list, items });
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
  _getItem(value, list, index, items, type, options)
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
  _setRows(list, source, type, options)
  {
    // A load starts from empty rows: a constructor's rows would show through a bag that left a default out.
    if (CjsGraph.isLoadingList(options)) list.length = 0;

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
  IsValidValue(value)
  {
    return Array.isArray(value);
  }


  /** Stable class identity. */
  static className = "CjsGraphTypeList";

}
