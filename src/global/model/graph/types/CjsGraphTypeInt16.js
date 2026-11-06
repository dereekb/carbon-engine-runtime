import { CjsGraphTypeInteger } from "./CjsGraphTypeInteger.js";

/**
 * Int16 storage definition using shared numeric operations.
 * Modelled on: Be::SHORT storage family (blueexposure/include/BlueTypes.h:270); signed variant is a JS extension.
 * @cjs JavaScript storage conversion replaces native assignment; no Blue registration.
 */
export class CjsGraphTypeInt16 extends CjsGraphTypeInteger
{

  /** Definition name. */
  name = "Int16";

  /** Integer storage width. */
  static bits = 16;

  /** Integer signedness. */
  static signed = true;

  /** Stable class identity. */
  static className = "CjsGraphTypeInt16";

}
