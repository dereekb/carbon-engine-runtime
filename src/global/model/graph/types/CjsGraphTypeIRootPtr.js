import { CjsGraphTypeObject } from "./CjsGraphTypeObject.js";

/**
 * Explicit IROOTPTR definition without misleading value-operation fallbacks.
 * Carbon: Be::IROOTPTR (blueexposure/BlueVariable.cpp:346-437).
 * @cjs A strong reference; Set replaces it or reads into it.
 */
export class CjsGraphTypeIRootPtr extends CjsGraphTypeObject
{

  /** Distinct definition name. */
  name = "IRootPtr";

  /** Stable class identity. */
  static className = "CjsGraphTypeIRootPtr";

}
