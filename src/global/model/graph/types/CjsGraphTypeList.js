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
   * Instance shortcut to get.
   * @cjs
   */
  Get(target, key, options)
  {
    return this.constructor.get(target, key, options);
  }

  /** Stable class identity. */
  static className = "CjsGraphTypeList";

}
