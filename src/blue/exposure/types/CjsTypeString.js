import { VARTYPE } from "../BlueTypes.js";
import { CjsTypeScalar } from "./CjsTypeScalar.js";

/**
 * String storage definition and value operations.
 * Modelled on: Be::STDSTRING (blueexposure/BlueVariable.cpp:879-905)
 * @cjs JavaScript handler with native storage identity; assignment uses JS conversion.
 */
export class CjsTypeString extends CjsTypeScalar
{

  /** Definition name. */
  name = "String";

  /** Carbon storage identifier. */
  varType = VARTYPE.STDSTRING;

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
   * Tests the JavaScript value representation.
   * @cjs Explicit query, not Set validation.
   */
  static is(value)
  {
    return typeof value === "string";
  }

  /**
   * Compares stored values. Modelled on: Be::STDSTRING (blueexposure/BlueVariable.cpp:879-905).
   * @adapted JavaScript values replace native union members.
   */
  static isEqual(a, b)
  {
    return a === b;
  }

  /** Stable class identity. */
  static className = "CjsTypeString";

}
