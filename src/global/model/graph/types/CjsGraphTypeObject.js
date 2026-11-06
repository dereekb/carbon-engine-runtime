import { CjsGraph } from "../CjsGraph.js";

/**
 * Shared operations for a member that holds one object.
 *
 * This is a type handler, not a trait or a new Carbon VARTYPE. It holds no graph logic:
 * CjsGraph walks the object, and this class is what the walk calls for such a member.
 *
 * @cjs No single Carbon donor: IRoot, IRootPtr and IRootWeakRef specialise it.
 */
export class CjsGraphTypeObject
{

  /** Definition name. */
  name = "Object";

  /**
   * Returns the held object's values, or an alias to them.
   * @cjs options is the running operation; its member names the declared type.
   */
  static get(target, key, options)
  {
    return CjsGraph.getObject(target[key], options.member.edge.type, options);
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
  static className = "CjsGraphTypeObject";

}
