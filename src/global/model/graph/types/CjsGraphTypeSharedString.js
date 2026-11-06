import { CjsGraphTypeCString } from "./CjsGraphTypeCString.js";

/**
 * Distinct SHAREDSTRING definition sharing its JavaScript string operations.
 * Carbon: Be::SHAREDSTRING (blueexposure/BlueVariable.cpp:1012-1041).
 * @adapted Immutable JS string equality replaces native interned-pointer equality; no new interning pool.
 * Native BlueSharedStringT constructs from c_str() (blueexposure/include/BlueSharedString.h:115-119),
 * so storage retains the NUL-terminated prefix even when the input is std::string/std::wstring.
 */
export class CjsGraphTypeSharedString extends CjsGraphTypeCString
{

  /** Distinct definition name, even when JavaScript storage is shared. */
  name = "SharedString";

  /** Stable class identity. */
  static className = "CjsGraphTypeSharedString";

}
