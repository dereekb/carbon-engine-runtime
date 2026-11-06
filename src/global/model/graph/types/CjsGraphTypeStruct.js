import { CjsGraphTypeIRoot } from "./CjsGraphTypeIRoot.js";

/**
 * Operations for a member that embeds a struct.
 *
 * This is a type handler, not a trait or a new Carbon VARTYPE.
 *
 * @cjs No single Carbon donor: a struct is written and read as an embedded object.
 */
export class CjsGraphTypeStruct extends CjsGraphTypeIRoot
{

  /** Distinct definition name. */
  name = "Struct";

  /** Stable class identity. */
  static className = "CjsGraphTypeStruct";

}
