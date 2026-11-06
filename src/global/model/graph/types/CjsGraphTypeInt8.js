import { CjsGraphTypeInteger } from "./CjsGraphTypeInteger.js";

/**
 * Int8 storage definition using shared numeric operations.
 * Modelled on: Be::BYTE storage family (blueexposure/include/BlueTypes.h:269); signed variant is a JS extension.
 * @cjs JavaScript storage conversion replaces native assignment; no Blue registration.
 */
export class CjsGraphTypeInt8 extends CjsGraphTypeInteger
{

  /** Definition name. */
  name = "Int8";

  /** Integer storage width. */
  static bits = 8;

  /** Integer signedness. */
  static signed = true;

  /** Stable class identity. */
  static className = "CjsGraphTypeInt8";

}
