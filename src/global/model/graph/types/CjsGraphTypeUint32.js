import { CjsGraphTypeInteger } from "./CjsGraphTypeInteger.js";

/**
 * Uint32 storage definition using shared numeric operations.
 * Modelled on: Be::ULONG (blueexposure/BlueVariable.cpp:178-196).
 * @cjs JavaScript storage conversion replaces native assignment; no Blue registration.
 */
export class CjsGraphTypeUint32 extends CjsGraphTypeInteger
{

  /** Definition name. */
  name = "Uint32";

  /** Integer storage width. */
  static bits = 32;

  /** Integer signedness. */
  static signed = false;

  /** Stable class identity. */
  static className = "CjsGraphTypeUint32";

}
