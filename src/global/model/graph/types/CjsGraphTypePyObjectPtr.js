/**
 * Explicit PYOBJECTPTR definition without misleading value-operation fallbacks.
 * Carbon: Be::PYOBJECTPTR (blueexposure/BlueVariable.cpp:606-626).
 * @notSupported Python pointers and interpreter reference counts have no storage implementation in this JS runtime.
 */
export class CjsGraphTypePyObjectPtr
{

  /** Distinct definition name. */
  name = "PyObjectPtr";

  /** Stable class identity. */
  static className = "CjsGraphTypePyObjectPtr";

}
