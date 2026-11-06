import { CjsGraphTypeInteger } from "./CjsGraphTypeInteger.js";

/**
 * Uint8 storage definition using shared numeric operations.
 * Modelled on: Be::BYTE (blueexposure/BlueVariable.cpp:939-965).
 * @cjs JavaScript storage conversion replaces native assignment; no Blue registration.
 */
export class CjsGraphTypeUint8 extends CjsGraphTypeInteger
{

  /** Definition name. */
  name = "Uint8";

  /** Integer storage width. */
  static bits = 8;

  /** Integer signedness. */
  static signed = false;

  /** Stable class identity. */
  static className = "CjsGraphTypeUint8";

}
