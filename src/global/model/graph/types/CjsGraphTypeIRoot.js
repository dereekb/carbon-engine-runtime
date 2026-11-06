import { CjsGraphTypeObject } from "./CjsGraphTypeObject.js";

/**
 * Explicit IROOT definition without misleading value-operation fallbacks.
 * Carbon: Be::IROOT (blueexposure/BlueVariable.cpp:274-343).
 * @cjs An embedded object keeps its identity; Set reads into it.
 */
export class CjsGraphTypeIRoot extends CjsGraphTypeObject
{

  /** Distinct definition name. */
  name = "IRoot";

  /** Stable class identity. */
  static className = "CjsGraphTypeIRoot";

}
