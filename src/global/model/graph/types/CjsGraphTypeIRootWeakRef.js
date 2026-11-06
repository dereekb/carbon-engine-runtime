import { CjsGraphTypeObject } from "./CjsGraphTypeObject.js";

/**
 * Explicit IROOTWEAKREF definition without misleading value-operation fallbacks.
 * Carbon: Be::IROOTWEAKREF (blueexposure/BlueVariable.cpp:817-875).
 * @notImplemented Weak object references require the graph reference/ownership policy; no eager JS WeakRef substitution.
 */
export class CjsGraphTypeIRootWeakRef extends CjsGraphTypeObject
{

  /** Distinct definition name. */
  name = "IRootWeakRef";

  /** Stable class identity. */
  static className = "CjsGraphTypeIRootWeakRef";

}
