import { CjsGraphTypeObject } from "./CjsGraphTypeObject.js";

/**
 * Operations for a member that embeds a struct.
 *
 * This is a type handler, not a trait or a new Carbon VARTYPE.
 *
 * @cjs No single Carbon donor: a struct is written as an object, as IRootWriter writes it.
 */
export class CjsGraphTypeStruct extends CjsGraphTypeObject
{

  /** Distinct definition name. */
  name = "Struct";

  /** Stable class identity. */
  static className = "CjsGraphTypeStruct";

}
