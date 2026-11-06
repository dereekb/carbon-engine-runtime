import { CjsGraphTypeFloat64Array } from "./CjsGraphTypeFloat64Array.js";

/**
 * Carbon Vector4d identity and fixed element count over current JS typed storage.
 * Carbon: BlueTypeTraits<Vector4d> (blueexposure/include/BlueTypeTraits.h:64-73).
 * @adapted Float64Array remains the current representation. No math, normalization,
 * colour-space conversion, layout conversion or value defaults are introduced here.
 */
export class CjsGraphTypeVector4d extends CjsGraphTypeFloat64Array
{

  /** Distinct semantic definition name. */
  name = "Vector4d";

  /** Default declared count used by both static and instance operations. */
  static defaultLength = 4;

  /** Stable class identity. */
  static className = "CjsGraphTypeVector4d";

}
