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
