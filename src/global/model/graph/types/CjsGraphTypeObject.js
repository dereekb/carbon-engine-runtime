import { CjsGraph } from "../CjsGraph.js";

/**
 * IROOTPTR and IROOTWEAKREF members: a reference to one object.
 * Modelled on: Be::IROOTPTR (blueexposure/BlueVariable.cpp:346-437).
 * @cjs Holds no graph logic: CjsGraph walks the object, and this is what the walk calls for such a member.
 */
export class CjsGraphTypeObject
{

  /**
   * Returns the held object's values, or an alias to them.
   * @cjs options is the running operation.
   */
  Get(target, key, member, options)
  {
    return CjsGraph.getObject(target[key], member.edgeType, options);
  }

  /**
   * Writes a null, an _id reference or a live object, or reads a bag into the held object.
   * A bag creates an object when nothing is held, when its _type is another class, or in a
   * copy, as Copy<IROOTPTR> always does (BlueVariable.cpp:430).
   * Returns false, true for a null, the live object, or the nested change record.
   * Modelled on: Blue::DictReader::ReadIRootPtr; a bag reads into the object held (door rule).
   * @cjs A non-plain value is a reference: the declared type decides, not the value.
   */
  Set(target, key, value, member, options)
  {
    const current = target[key];

    if (value === null)
    {
      if (current === null) return false;

      target[key] = null;
      return true;
    }

    const type = member.edgeType;
    let object = value;

    if (CjsGraph.isPlain(value))
    {
      if (value._ref === undefined)
      {
        if (current !== null && CjsGraph.isReadingInto(options) && (value._type === undefined || CjsGraph.isType(current, value._type)))
          return CjsGraph.setObject(current, value, type, options);

        object = CjsGraph.createObject(value, type, options);
        target[key] = object;
        return object;
      }

      object = options.anchors.get(value._ref);

      if (object === undefined)
      {
        options.deferred = CjsGraph.deferReference(target, key, value._ref, type, null, null, options);
        return true;
      }
    }

    if (object === current) return false;

    target[key] = object;
    return object;
  }

  /**
   * Tests valid input: a bag, an _id reference or a live object.
   * @cjs The graph operation calls it, and passes null around it.
   */
  IsValidValue(value)
  {
    return typeof value === "object" && !Array.isArray(value) && !ArrayBuffer.isView(value);
  }


  /** Stable class identity. */
  static className = "CjsGraphTypeObject";

}
