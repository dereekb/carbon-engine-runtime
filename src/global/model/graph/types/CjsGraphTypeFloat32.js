import { CjsGraphTypeScalar } from "./CjsGraphTypeScalar.js";

/**
 * Float32 storage definition and value operations.
 * Modelled on: Be::FLOAT (blueexposure/BlueVariable.cpp:200-220)
 * @cjs JavaScript value handler; Blue supplies native exposure identity externally.
 */
export class CjsGraphTypeFloat32 extends CjsGraphTypeScalar
{

  /** Definition name. */
  name = "Float32";

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
    if (!this.is(a) || !this.is(b)) return false;

    return Math.abs(Math.fround(a - b)) < Math.fround(1e-6);
  }

  /** Stable class identity. */
  static className = "CjsGraphTypeFloat32";

}
