import { CjsGraphTypeFloat32Array } from "./CjsGraphTypeFloat32Array.js";

/**
 * Carbon Matrix identity and fixed element count over current JS typed storage.
 * Carbon: BlueTypeTraits<Matrix> (blueexposure/include/BlueTypeTraits.h:64-73).
 * @adapted Float32Array remains the current representation. No math, normalization,
 * colour-space conversion, layout conversion or value defaults are introduced here.
 */
export class CjsGraphTypeMatrix extends CjsGraphTypeFloat32Array
{

  /** Distinct semantic definition name. */
  name = "Matrix";

  /** Default declared count used by both static and instance operations. */
  static defaultLength = 16;

  /** Stable class identity. */
  static className = "CjsGraphTypeMatrix";

}
