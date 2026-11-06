import { CjsGraphTypeWCString } from "./CjsGraphTypeWCString.js";

/**
 * Distinct SHAREDSTRINGW definition sharing its JavaScript string operations.
 * Carbon: Be::SHAREDSTRINGW (blueexposure/BlueVariable.cpp:1047-1080).
 * @adapted Immutable wide JS text replaces native interned-pointer equality; no new interning pool.
 * Native BlueSharedStringT constructs from c_str() (blueexposure/include/BlueSharedString.h:115-119),
 * so storage retains the NUL-terminated prefix even when the input is std::string/std::wstring.
 */
export class CjsGraphTypeSharedStringW extends CjsGraphTypeWCString
{

  /** Distinct definition name, even when JavaScript storage is shared. */
  name = "SharedStringW";

  /** Stable class identity. */
  static className = "CjsGraphTypeSharedStringW";

}
