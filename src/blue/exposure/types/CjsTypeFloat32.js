import { VARTYPE } from "../BlueTypes.js";
import { CjsTypeScalar } from "./CjsTypeScalar.js";

/**
 * Float32 storage definition and value operations.
 * Modelled on: Be::FLOAT (blueexposure/BlueVariable.cpp:200-220)
 * @cjs JavaScript handler with native storage identity; assignment uses JS conversion.
 */
export class CjsTypeFloat32 extends CjsTypeScalar
{

  /** Definition name. */
  name = "Float32";

  /** Carbon storage identifier. */
  varType = VARTYPE.FLOAT;

  /** JavaScript value constructor. */
  ctor = Number;

  /**
   * Converts to Float32 storage.
   * @cjs JS conversion replaces native assignment.
   */
  static convert(value)
  {
    return Math.fround(value);
  }

  /**
   * Tests the JavaScript value representation.
   * @cjs Explicit query, not Set validation.
   */
  static is(value)
  {
    return typeof value === "number";
  }

  /**
   * Compares stored values. Modelled on: Be::FLOAT (blueexposure/BlueVariable.cpp:200-220).
   * @adapted JavaScript values replace native union members.
   */
  static isEqual(a, b)
  {
    return Math.abs(Math.fround(a - b)) < Math.fround(1e-6);
  }

  /** Stable class identity. */
  static className = "CjsTypeFloat32";

}
