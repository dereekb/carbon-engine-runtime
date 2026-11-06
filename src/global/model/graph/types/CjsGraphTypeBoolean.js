import { CjsGraphTypeScalar } from "./CjsGraphTypeScalar.js";

/**
 * Boolean storage definition and value operations.
 * Modelled on: Be::BOOL (blueexposure/BlueVariable.cpp:250-271)
 * @cjs JavaScript value handler; Blue supplies native exposure identity externally.
 */
export class CjsGraphTypeBoolean extends CjsGraphTypeScalar
{

  /** Definition name. */
  name = "Boolean";

  /** JavaScript value constructor. */
  ctor = Boolean;

  /** Converts to Boolean storage.
   * @cjs JS conversion replaces native assignment.
   */
  static convert(value)
  {
    return Boolean(value);
  }

  /** Tests the JavaScript value representation.
   * @cjs Explicit query, not Set validation.
   */
  static isValidValue(value)
  {
    return typeof value === "boolean";
  }

  /** Stable class identity. */
  static className = "CjsGraphTypeBoolean";

}
