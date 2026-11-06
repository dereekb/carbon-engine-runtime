import { CjsGraphTypeCString } from "./CjsGraphTypeCString.js";

/**
 * Distinct REFERENCE definition sharing its JavaScript string operations.
 * Carbon: Be::REFERENCE (blueexposure/BlueVariable.cpp:631-659).
 * @adapted RotID text remains distinct from ordinary strings. No path normalization or resource lookup occurs here.
 * The native Python exporter reads narrow storage as wide text; that unsafe pointer
 * reinterpretation is not part of these JS value operations or an implemented Python codec.
 */
export class CjsGraphTypeReference extends CjsGraphTypeCString
{

  /** Distinct definition name, even when JavaScript storage is shared. */
  name = "Reference";

  /** Stable class identity. */
  static className = "CjsGraphTypeReference";

}
