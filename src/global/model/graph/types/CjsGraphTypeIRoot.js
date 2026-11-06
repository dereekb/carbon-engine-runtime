import { CjsGraphTypeObject } from "./CjsGraphTypeObject.js";

/**
 * Explicit IROOT definition without misleading value-operation fallbacks.
 * Carbon: Be::IROOT (blueexposure/BlueVariable.cpp:274-343).
 * @notImplemented Embedded-object population/copy requires the graph operation context; not a shallow scalar assignment.
 */
export class CjsGraphTypeIRoot extends CjsGraphTypeObject
{

  /** Distinct definition name. */
  name = "IRoot";

  /** Stable class identity. */
  static className = "CjsGraphTypeIRoot";

}
