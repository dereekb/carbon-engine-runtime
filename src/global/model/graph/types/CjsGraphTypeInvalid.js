import { CjsGraphTypeScalar } from "./CjsGraphTypeScalar.js";

/**
 * Default handler for an unresolved type; every value operation throws.
 * Carbon: Be::INVALID (blueexposure/include/BlueTypes.h:219).
 * @cjs Operator-approved throwing JS handler for the invalid sentinel.
 * Inherits only instance forwarding; all static value operations are overridden.
 */
export class CjsGraphTypeInvalid extends CjsGraphTypeScalar
{

  /** Distinct definition name. */
  name = "Invalid";

  /**
   * Rejects get because no valid value type has been assigned.
   * @cjs Fails before inspecting or changing the supplied values.
   */
  static get(target, key)
  {
    throw new TypeError(`Invalid type handler cannot get property ${String(key)}.`);
  }

  /**
   * Rejects set because no valid value type has been assigned.
   * @cjs Fails before inspecting or changing the supplied values.
   */
  static set(target, key, value)
  {
    throw new TypeError(`Invalid type handler cannot set property ${String(key)}.`);
  }

  /**
   * Rejects copy because no valid value type has been assigned.
   * @cjs Fails before inspecting or changing the supplied values.
   */
  static copy(source, sourceKey, target, key)
  {
    throw new TypeError(`Invalid type handler cannot copy property ${String(sourceKey)} to ${String(key)}.`);
  }

  /**
   * Rejects clone because no valid value type has been assigned.
   * @cjs Fails before inspecting or changing the supplied values.
   */
  static clone(target, key)
  {
    throw new TypeError(`Invalid type handler cannot clone property ${String(key)}.`);
  }

  /**
   * Rejects convert because no valid value type has been assigned.
   * @cjs Fails before inspecting or changing the supplied values.
   */
  static convert(value)
  {
    throw new TypeError("Invalid type handler cannot convert a value.");
  }

  /**
   * Rejects is because no valid value type has been assigned.
   * @cjs Fails before inspecting or changing the supplied values.
   */
  static isValidValue(value)
  {
    throw new TypeError("Invalid type handler cannot test a value.");
  }

  /**
   * Rejects isExactEqual because no valid value type has been assigned.
   * @cjs Fails before inspecting or changing the supplied values.
   */
  static isExactEqual(a, b)
  {
    throw new TypeError("Invalid type handler cannot compare exact values.");
  }

  /**
   * Rejects isEqual because no valid value type has been assigned.
   * @cjs Fails before inspecting or changing the supplied values.
   */
  static isEqual(a, b)
  {
    throw new TypeError("Invalid type handler cannot compare values.");
  }

  /**
   * Rejects isLike because no valid value type has been assigned.
   * @cjs Fails before inspecting or changing the supplied values.
   */
  static isLike(a, b)
  {
    throw new TypeError("Invalid type handler cannot compare representations.");
  }

  /** Stable class identity. */
  static className = "CjsGraphTypeInvalid";

}
