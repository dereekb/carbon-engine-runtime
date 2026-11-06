import { CjsGraphTypeBigInt } from "./CjsGraphTypeBigInt.js";

/**
 * Int64 storage definition using shared numeric operations.
 * Modelled on: Be::INT64 (blueexposure/BlueVariable.cpp:504-539).
 * @cjs JavaScript storage conversion replaces native assignment; no Blue registration.
 */
export class CjsGraphTypeInt64 extends CjsGraphTypeBigInt
{

  /** Definition name. */
  name = "Int64";

  /** Integer signedness. */
  static signed = true;

  /** Stable class identity. */
  static className = "CjsGraphTypeInt64";

}
