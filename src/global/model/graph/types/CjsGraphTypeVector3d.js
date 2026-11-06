import { CjsGraphTypeFloat64Array } from "./CjsGraphTypeFloat64Array.js";

/**
 * Carbon Vector3d identity and fixed element count over current JS typed storage.
 * Carbon: BlueTypeTraits<Vector3d> (blueexposure/include/BlueTypeTraits.h:64-73).
 * @adapted Float64Array remains the current representation. No math, normalization,
 * colour-space conversion, layout conversion or value defaults are introduced here.
 */
export class CjsGraphTypeVector3d extends CjsGraphTypeFloat64Array
{

  /** Distinct semantic definition name. */
  name = "Vector3d";

  /** Default declared count used by both static and instance operations. */
  static elementCount = 3;

  /** Stable class identity. */
  static className = "CjsGraphTypeVector3d";

}
