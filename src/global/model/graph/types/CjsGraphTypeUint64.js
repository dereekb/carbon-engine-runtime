import { CjsGraphTypeBigInt } from "./CjsGraphTypeBigInt.js";

/**
 * Uint64 storage definition using shared numeric operations.
 * Modelled on: Be::UINT64 (blueexposure/BlueVariable.cpp:544-582).
 * @cjs JavaScript storage conversion replaces native assignment; no Blue registration.
 */
export class CjsGraphTypeUint64 extends CjsGraphTypeBigInt
{

  /** Definition name. */
  name = "Uint64";

  /** Integer signedness. */
  static signed = false;

  /** Stable class identity. */
  static className = "CjsGraphTypeUint64";

}
