import { CjsGraphTypeObject } from "./CjsGraphTypeObject.js";

/**
 * Explicit IROOTPTR definition without misleading value-operation fallbacks.
 * Carbon: Be::IROOTPTR (blueexposure/BlueVariable.cpp:346-437).
 * @notImplemented Strong object references require graph identity, IID and ownership policy from the future graph operation.
 */
export class CjsGraphTypeIRootPtr extends CjsGraphTypeObject
{

  /** Distinct definition name. */
  name = "IRootPtr";

  /** Stable class identity. */
  static className = "CjsGraphTypeIRootPtr";

}
