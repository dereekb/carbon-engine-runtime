import { CjsGraph } from "../CjsGraph.js";

/**
 * Operations for a member that holds a Map of names to objects.
 *
 * This is a type handler, not a trait or a new Carbon VARTYPE. It holds no graph logic:
 * CjsGraph walks each object, and this class is what the walk calls for such a member.
 * Its member declares an edge with map set. A Map of leaf values is not implemented.
 *
 * @cjs No single Carbon donor: a JS Map in JSON form, as an object keyed by name.
 */
export class CjsGraphTypeMap
{

  /** Definition name. */
  name = "Map";

  /**
   * Returns a bag of each entry's values; a null entry stays null.
   * @cjs The member is read once: nested objects overwrite options.member.
   */
  static get(target, key, options)
  {
    const type = options.member.edge.type;
    const values = {}; // alloc: the returned bag.

    for (const [ name, item ] of target[key])
    {
      values[String(name)] = item === null ? null : CjsGraph.getObject(item, type, options);
    }

    return values;
  }

  /**
   * Replaces the Map's contents in place, as a list does: objects stay, bags are new, and the
   * rest are removed. A value that already matches is no change. A null empties the Map.
   * Returns false, or the new contents as a plain bag.
   * @cjs A forward reference holds its entry with null until the end of the operation.
   */
  static set(target, key, value, options)
  {
    if (value === null && target[key] === null) return false;

    const type = options.member.edge.type;
    const map = target[key] ??= new Map(); // alloc: a member holding no Map gets one.
    const entries = this._getEntries(value);

    if (map.size === 0 && entries.length === 0) return false;
    if (!CjsGraph.isWritingAll(options) && this._isEntriesLike(map, entries, type, options)) return false;

    const record = {}; // alloc: the change record.
    map.clear();

    for (const [ name, item ] of entries)
    {
      const object = this._getItem(item, map, name, record, type, options);
      map.set(name, object);
      record[String(name)] = object;
    }

    return record;
  }

  /**
   * Tests valid input: a Map or a plain object.
   * @cjs The graph operation calls it, and passes null around it.
   */
  static isValidValue(value)
  {
    return value instanceof Map || (typeof value === "object" && !Array.isArray(value) && CjsGraph.isPlain(value));
  }

  /**
   * Whether Set has nothing to do.
   * @cjs Compares objects through the graph, as a list does.
   */
  static isUnchanged(stored, value, options)
  {
    return this._isEntriesLike(stored, this._getEntries(value), options.member.edge.type, options);
  }

  /** The entries of a Map, a bag or a null. @cjs */
  static _getEntries(value)
  {
    if (value === null) return [];

    return value instanceof Map ? Array.from(value) : Object.entries(value);
  }

  /** Tests whether a Map already holds these entries, writing nothing. @cjs */
  static _isEntriesLike(map, entries, type, options)
  {
    if (map.size !== entries.length) return false;

    for (const [ name, item ] of entries)
    {
      if (!map.has(name) || !CjsGraph.isObjectLike(map.get(name), item, type, options)) return false;
    }

    return true;
  }

  /** Resolves one incoming entry. @cjs */
  static _getItem(value, map, name, record, type, options)
  {
    if (value === null || !CjsGraph.isPlain(value)) return value;
    if (value._ref === undefined) return CjsGraph.createObject(value, type, options);

    const object = options.anchors.get(value._ref);
    if (object !== undefined) return object;

    CjsGraph.deferReference(map, name, value._ref, type, record, String(name), options);
    return null;
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

  /**
   * Instance shortcut to isUnchanged.
   * @cjs
   */
  IsUnchanged(stored, value, options)
  {
    return this.constructor.isUnchanged(stored, value, options);
  }

  /** Stable class identity. */
  static className = "CjsGraphTypeMap";

}
