import { CjsGraphTypeFloat64Array } from "./CjsGraphTypeFloat64Array.js";

/**
 * Carbon Vector2d identity and fixed element count over current JS typed storage.
 * Carbon: BlueTypeTraits<Vector2d> (blueexposure/include/BlueTypeTraits.h:64-73).
 * @adapted Float64Array remains the current representation. No math, normalization,
 * colour-space conversion, layout conversion or value defaults are introduced here.
 */
export class CjsGraphTypeVector2d extends CjsGraphTypeFloat64Array
{

  /** Distinct semantic definition name. */
  name = "Vector2d";

  /** Default declared count used by both static and instance operations. */
  static defaultLength = 2;

  /** Stable class identity. */
  static className = "CjsGraphTypeVector2d";

}
