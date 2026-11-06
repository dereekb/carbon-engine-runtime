/**
 * Explicit PYOBJECT definition without misleading value-operation fallbacks.
 * Carbon: Be::PYOBJECT (blueexposure/BlueVariable.cpp:585-603).
 * @notSupported Python object storage requires a Python runtime; no equivalent JS object-copy contract is implied.
 */
export class CjsGraphTypePyObject
{

  /** Distinct definition name. */
  name = "PyObject";

  /** Stable class identity. */
  static className = "CjsGraphTypePyObject";

}
