import { CjsGraphTypeString } from "./CjsGraphTypeString.js";

/**
 * NUL-terminated text operations shared by Carbon's C and reference strings.
 * Carbon: Be::CSTRING (blueexposure/BlueVariable.cpp:473-501).
 * @adapted Immutable JS text replaces allocated pointers; no free/strdup operation is needed.
 * Native null pointers are not a second authored JS string value. Byte/wide encoding belongs
 * to readers/writers. These operations preserve the visible prefix before the first NUL.
 */
export class CjsGraphTypeCString extends CjsGraphTypeString
{

  /** Definition name. */
  name = "CString";

  /**
   * Returns the visible C-string prefix.
   * @adapted Decoded JS text replaces pointer-based string access.
   */
  static get(target, key, options)
  {
    return this.convert(target[key], options);
  }

  /**
   * Converts to text, retaining only the NUL-terminated prefix.
   * @adapted String conversion replaces native caller-language extraction and strdup.
   */
  static convert(value, options)
  {
    const text = super.convert(value, options);
    const end = text.indexOf("\0");
    return end < 0 ? text : text.slice(0, end);
  }

  /**
   * Copies the visible immutable text without preserving inaccessible trailing bytes.
   * @adapted JS strings need no independently allocated native character buffer.
   */
  static clone(target, key, options)
  {
    return this.get(target, key, options);
  }

  /**
   * Compares visible prefixes, as strcmp/wcscmp do.
   * Carbon: CompareStrings/CompareWStrings (blueexposure/BlueVariable.cpp:5-35).
   * @adapted Only JS string representations are compared; native null pointers stay outside this storage type.
   */
  static isEqual(a, b)
  {
    return this.is(a) && this.is(b) && this.convert(a) === this.convert(b);
  }

  /** Stable class identity. */
  static className = "CjsGraphTypeCString";

}
