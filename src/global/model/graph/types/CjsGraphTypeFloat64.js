import { CjsGraphTypeScalar } from "./CjsGraphTypeScalar.js";

/**
 * Float64 storage definition and value operations.
 * Modelled on: Be::DOUBLE (blueexposure/BlueVariable.cpp:224-244)
 * @cjs JavaScript value handler; Blue supplies native exposure identity externally.
 */
export class CjsGraphTypeFloat64 extends CjsGraphTypeScalar
{

  /** Definition name. */
  name = "Float64";

  /** JavaScript value constructor. */
  ctor = Number;

  /**
   * Converts to Float64 storage.
   * @cjs JS conversion replaces native assignment.
   */
  static convert(value)
  {
    return Number(value);
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
   * Compares stored values. Modelled on: Be::DOUBLE (blueexposure/BlueVariable.cpp:224-244).
   * @adapted JavaScript values replace native union members.
   */
  static isEqual(a, b)
  {
    if (!this.is(a) || !this.is(b)) return false;

    return Math.abs(a - b) < 1e-12;
  }

  /** Stable class identity. */
  static className = "CjsGraphTypeFloat64";

}
