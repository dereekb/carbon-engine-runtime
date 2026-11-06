import { CjsGraphTypeFloat32Array } from "./CjsGraphTypeFloat32Array.js";

/**
 * Carbon Vector4 identity and fixed element count over current JS typed storage.
 * Carbon: BlueTypeTraits<Vector4> (blueexposure/include/BlueTypeTraits.h:64-73).
 * @adapted Float32Array remains the current representation. No math, normalization,
 * colour-space conversion, layout conversion or value defaults are introduced here.
 */
export class CjsGraphTypeVector4 extends CjsGraphTypeFloat32Array
{

  /** Distinct semantic definition name. */
  name = "Vector4";

  /** Default declared count used by both static and instance operations. */
  static elementCount = 4;

  /** Stable class identity. */
  static className = "CjsGraphTypeVector4";

}
