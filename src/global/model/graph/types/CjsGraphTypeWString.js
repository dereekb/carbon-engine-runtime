import { CjsGraphTypeString } from "./CjsGraphTypeString.js";

/**
 * Distinct STDWSTRING definition sharing its JavaScript string operations.
 * Carbon: Be::STDWSTRING (blueexposure/BlueVariable.cpp:909-936).
 * @adapted JavaScript strings replace std::wstring storage; encoding remains a reader/writer responsibility.
 */
export class CjsGraphTypeWString extends CjsGraphTypeString
{

  /** Distinct definition name, even when JavaScript storage is shared. */
  name = "WString";

  /** Stable class identity. */
  static className = "CjsGraphTypeWString";

}
