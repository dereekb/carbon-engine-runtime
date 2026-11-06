import { CjsGraphTypeInt32Array } from "./CjsGraphTypeInt32Array.js";

/**
 * Carbon Vector3i identity and fixed element count over current JS typed storage.
 * Carbon: BlueTypeTraits<Vector3i> (blueexposure/include/BlueTypeTraits.h:64-73).
 * @adapted Int32Array remains the current representation. No math, normalization,
 * colour-space conversion, layout conversion or value defaults are introduced here.
 */
export class CjsGraphTypeVector3i extends CjsGraphTypeInt32Array
{

  /** Distinct semantic definition name. */
  name = "Vector3i";

  /** Default declared count used by both static and instance operations. */
  static elementCount = 3;

  /** Stable class identity. */
  static className = "CjsGraphTypeVector3i";

}
