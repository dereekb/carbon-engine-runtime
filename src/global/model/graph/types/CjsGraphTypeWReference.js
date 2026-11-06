import { CjsGraphTypeWCString } from "./CjsGraphTypeWCString.js";

/**
 * Distinct WREFERENCE definition sharing its JavaScript string operations.
 * Carbon: Be::WREFERENCE (blueexposure/BlueVariable.cpp:699-732).
 * @adapted Wide RotID text remains distinct from ordinary strings. No path normalization or resource lookup occurs here.
 */
export class CjsGraphTypeWReference extends CjsGraphTypeWCString
{

  /** Distinct definition name, even when JavaScript storage is shared. */
  name = "WReference";

  /** Stable class identity. */
  static className = "CjsGraphTypeWReference";

}
