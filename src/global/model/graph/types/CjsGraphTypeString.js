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

  /**
   * Compares stored values. Modelled on: Be::STDSTRING (blueexposure/BlueVariable.cpp:879-905).
   * @adapted JavaScript values replace native union members.
   */
  static isEqual(a, b)
  {
    if (!this.isValidValue(a) || !this.isValidValue(b)) return false;

    return a === b;
  }

  /** Stable class identity. */
  static className = "CjsGraphTypeString";

}
