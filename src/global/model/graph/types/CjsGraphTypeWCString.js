import { CjsGraphTypeCString } from "./CjsGraphTypeCString.js";

/**
 * Distinct WCSTRING definition sharing its JavaScript string operations.
 * Carbon: Be::WCSTRING (blueexposure/BlueVariable.cpp:663-696).
 * @adapted Wide string identity with shared NUL-terminated JS text operations; no native pointer allocation.
 */
export class CjsGraphTypeWCString extends CjsGraphTypeCString
{

  /** Distinct definition name, even when JavaScript storage is shared. */
  name = "WCString";

  /** Stable class identity. */
  static className = "CjsGraphTypeWCString";

}
