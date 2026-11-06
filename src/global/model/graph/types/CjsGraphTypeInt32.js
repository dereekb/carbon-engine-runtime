import { CjsGraphTypeInteger } from "./CjsGraphTypeInteger.js";

/**
 * Int32 storage definition using shared numeric operations.
 * Modelled on: Be::LONG (blueexposure/BlueVariable.cpp:151-174).
 * @cjs JavaScript storage conversion replaces native assignment; no Blue registration.
 */
export class CjsGraphTypeInt32 extends CjsGraphTypeInteger
{

  /** Definition name. */
  name = "Int32";

  /** Integer storage width. */
  static bits = 32;

  /** Integer signedness. */
  static signed = true;

  /** Stable class identity. */
  static className = "CjsGraphTypeInt32";

}
