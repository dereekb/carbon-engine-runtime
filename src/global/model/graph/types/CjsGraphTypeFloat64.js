import { CjsGraphTypeNumber } from "./CjsGraphTypeNumber.js";

/**
 * Float64 storage definition and value operations.
 * Modelled on: Be::DOUBLE (blueexposure/BlueVariable.cpp:224-244)
 * @cjs JavaScript value handler; Blue supplies native exposure identity externally.
 */
export class CjsGraphTypeFloat64 extends CjsGraphTypeNumber
{

  /** Definition name. */
  name = "Float64";

  /**
   * Compares values within Carbon's tolerance, so NaN and Infinity never equal themselves.
   * Modelled on: Be::DOUBLE (blueexposure/BlueVariable.cpp:224-244).
   * @adapted JavaScript values replace native union members.
   */
  static isEqual(a, b)
  {
    return Math.abs(this.convert(a) - this.convert(b)) < 1e-12;
  }

  /** Stable class identity. */
  static className = "CjsGraphTypeFloat64";

}
