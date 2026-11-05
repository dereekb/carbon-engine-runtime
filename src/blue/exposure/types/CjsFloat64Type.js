import { VARTYPE } from "../BlueTypes.js";
import { CjsScalarType } from "./CjsScalarType.js";

/**
 * Float64 storage definition and value operations.
 * Modelled on: Be::DOUBLE (blueexposure/BlueVariable.cpp:224-244)
 * @cjs JavaScript handler with native storage identity; assignment uses JS conversion.
 */
export class CjsFloat64Type extends CjsScalarType
{
  /** Stable class identity. */
  static className = "CjsFloat64Type";
  /** Definition name. */
  name = "Float64";
  /** Carbon storage identifier. */
  varType = VARTYPE.DOUBLE;
  /** JavaScript value constructor. */
  ctor = Number;

  /** Converts to Float64 storage. @cjs JS conversion replaces native assignment. */
  static convert(value)
  {
    return Number(value);
  }

  /** Tests the JavaScript value representation. @cjs Explicit query, not Set validation. */
  static is(value)
  {
    return typeof value === "number";
  }

  /** Compares stored values. Modelled on: Be::DOUBLE (blueexposure/BlueVariable.cpp:224-244). @adapted JavaScript values replace native union members. */
  static isEqual(a, b)
  {
    return Math.abs(a - b) < 1e-12;
  }
}
