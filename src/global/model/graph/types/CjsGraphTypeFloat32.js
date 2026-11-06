import { CjsGraphTypeNumber } from "./CjsGraphTypeNumber.js";

/**
 * Float32 storage definition and value operations.
 * Modelled on: Be::FLOAT (blueexposure/BlueVariable.cpp:200-220)
 * @cjs JavaScript value handler; Blue supplies native exposure identity externally.
 */
export class CjsGraphTypeFloat32 extends CjsGraphTypeNumber
{

  /** Definition name. */
  name = "Float32";

  /**
   * Converts to Float32 storage.
   * @cjs JS conversion replaces native assignment.
   */
  static convert(value)
  {
    return Math.fround(value);
  }

  /**
   * Compares values within Carbon's tolerance, so NaN and Infinity never equal themselves.
   * Modelled on: Be::FLOAT (blueexposure/BlueVariable.cpp:200-220).
   * @adapted JavaScript values replace native union members.
   */
  static isEqual(a, b)
  {
    return Math.abs(Math.fround(this.convert(a) - this.convert(b))) < Math.fround(1e-6);
  }

  /** Stable class identity. */
  static className = "CjsGraphTypeFloat32";

}
