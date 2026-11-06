/**
 * Explicit CHARARRAY definition without misleading value-operation fallbacks.
 * Carbon: Be::CHARARRAY (blueexposure/BlueVariable.cpp:441-470).
 * @notImplemented Fixed byte capacity, terminator space and full-buffer copy need a byte-storage contract; this is not an unrestricted String alias.
 */
export class CjsGraphTypeCharArray
{

  /** Distinct definition name. */
  name = "CharArray";

  /** Stable class identity. */
  static className = "CjsGraphTypeCharArray";

}
