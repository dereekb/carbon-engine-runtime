import { CjsGraphTypeInteger } from "./CjsGraphTypeInteger.js";

/**
 * Uint16 storage definition using shared numeric operations.
 * Modelled on: Be::SHORT (blueexposure/BlueVariable.cpp:968-994).
 * @cjs JavaScript storage conversion replaces native assignment; no Blue registration.
 */
export class CjsGraphTypeUint16 extends CjsGraphTypeInteger
{

  /** Definition name. */
  name = "Uint16";

  /** Integer storage width. */
  static bits = 16;

  /** Integer signedness. */
  static signed = false;

  /** Stable class identity. */
  static className = "CjsGraphTypeUint16";

}
