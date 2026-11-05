import { VARTYPE } from "../BlueTypes.js";
import { CjsScalarType } from "./CjsScalarType.js";

/**
 * Boolean storage definition and value operations.
 * Modelled on: Be::BOOL (blueexposure/BlueVariable.cpp:250-271)
 * @cjs JavaScript handler with native storage identity; assignment uses JS conversion.
 */
export class CjsBooleanType extends CjsScalarType
{
  /** Stable class identity. */
  static className = "CjsBooleanType";
  /** Definition name. */
  name = "Boolean";
  /** Carbon storage identifier. */
  varType = VARTYPE.BOOL;
  /** JavaScript value constructor. */
  ctor = Boolean;

  /** Converts to Boolean storage. @cjs JS conversion replaces native assignment. */
  static convert(value)
  {
    return Boolean(value);
  }

  /** Tests the JavaScript value representation. @cjs Explicit query, not Set validation. */
  static is(value)
  {
    return typeof value === "boolean";
  }

  /** Compares stored values. Modelled on: Be::BOOL (blueexposure/BlueVariable.cpp:250-271). @adapted JavaScript values replace native union members. */
  static isEqual(a, b)
  {
    return a === b;
  }
}
