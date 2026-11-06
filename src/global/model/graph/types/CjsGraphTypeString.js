import { CjsGraphTypeScalar } from "./CjsGraphTypeScalar.js";

/**
 * String storage definition and value operations.
 * Modelled on: Be::STDSTRING (blueexposure/BlueVariable.cpp:879-905)
 * @cjs JavaScript value handler; Blue supplies native exposure identity externally.
 */
export class CjsGraphTypeString extends CjsGraphTypeScalar
{

  /** Definition name. */
  name = "String";

  /** JavaScript value constructor. */
  ctor = String;

  /**
   * Converts to String storage.
   * @cjs JS conversion replaces native assignment.
   */
  static convert(value)
  {
    return String(value);
  }

  /**
   * Tests valid input.
   * @cjs The graph operation calls it; Set does not.
   */
  static isValidValue(value)
  {
    return typeof value === "string";
  }

  /** Stable class identity. */
  static className = "CjsGraphTypeString";

}
