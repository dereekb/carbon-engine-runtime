/**
 * A member with no value type. It describes and walks, and every value operation refuses.
 * Modelled on: Be::INVALID (blueexposure/include/BlueTypes.h:219)
 * @cjs Fails before reading or changing anything.
 */
export class CjsGraphTypeInvalid
{

  /** Refuses. @cjs */
  Get(_holder, key)
  {
    throw new TypeError(`Invalid type handler cannot get property ${String(key)}.`);
  }

  /** Refuses. @cjs */
  Set(_holder, key)
  {
    throw new TypeError(`Invalid type handler cannot set property ${String(key)}.`);
  }

  /** Refuses. @cjs */
  Write(_holder, key)
  {
    throw new TypeError(`Invalid type handler cannot write property ${String(key)}.`);
  }

  /** Refuses. @cjs */
  IsEqual()
  {
    throw new TypeError("Invalid type handler cannot compare values.");
  }

  /** Refuses. @cjs */
  IsUnchanged()
  {
    throw new TypeError("Invalid type handler cannot compare values.");
  }

  /** Refuses. @cjs */
  IsExactEqual()
  {
    throw new TypeError("Invalid type handler cannot compare values.");
  }

  /** Refuses. @cjs */
  IsValidValue()
  {
    throw new TypeError("Invalid type handler cannot test a value.");
  }

  /** Stable class identity. */
  static className = "CjsGraphTypeInvalid";

}
