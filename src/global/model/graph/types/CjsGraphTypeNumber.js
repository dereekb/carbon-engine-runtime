import { CjsGraphTypeScalar } from "./CjsGraphTypeScalar.js";

/**
 * Shared numeric property operations and canonical representation checks.
 * Modelled on: Be::LONG/ULONG/FLOAT/DOUBLE (blueexposure/BlueVariable.cpp:151-244).
 * @cjs JS handler inheritance replaces native template dispatch; Blue identity stays external.
 */
export class CjsGraphTypeNumber extends CjsGraphTypeScalar
{

  /** Definition name. */
  name = "Number";

  /** JavaScript value constructor. */
  ctor = this.constructor.ctor;

  /**
   * Converts through JavaScript Number.
   * @cjs Explicit JS conversion.
   */
  static convert(value)
  {
    return Number(value);
  }

  /**
   * Tests the canonical primitive representation.
   * @cjs Separate from assignment.
   */
  static is(value)
  {
    return typeof value === "number";
  }

  /**
   * Compares canonical numbers; floating specialisations supply Carbon tolerances.
   * @cjs
   */
  static isEqual(a, b)
  {
    return this.is(a) && this.is(b) && a === b;
  }

  /** Canonical JavaScript primitive constructor. */
  static ctor = Number;

  /** Stable class identity. */
  static className = "CjsGraphTypeNumber";

}
