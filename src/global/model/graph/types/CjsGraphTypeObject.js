import { CjsGraph } from "../CjsGraph.js";

/**
 * Shared operations for a member that holds a reference to one object.
 *
 * This is a type handler, not a trait or a new Carbon VARTYPE. It holds no graph logic:
 * CjsGraph walks the object, and this class is what the walk calls for such a member.
 *
 * @cjs No single Carbon donor: IRoot, IRootPtr and IRootWeakRef specialise it.
 */
export class CjsGraphTypeObject
{

  /** Definition name. */
  name = "Object";

  /**
   * Returns the held object's values, or an alias to them.
   * @cjs options is the running operation; its member names the declared type.
   */
  static get(target, key, options)
  {
    return CjsGraph.getObject(target[key], options.member.edge.type, options);
  }

  /**
   * Writes a null, an _id reference or a live object, or reads a bag into the held object.
   * A bag creates an object when nothing is held, when its _type is another class, or in a
   * copy, as Copy<IROOTPTR> always does (BlueVariable.cpp:430).
   * Returns false, true for a null, the live object, or the nested change record.
   * Modelled on: Blue::DictReader::ReadIRootPtr; a bag reads into the object held (door rule).
   * @cjs A non-plain value is a reference: the declared type decides, not the value.
   */
  static set(target, key, value, options)
  {
    const current = target[key];

    if (value === null)
    {
      if (current === null) return false;

      target[key] = null;
      return true;
    }

    const type = options.member.edge.type;
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
  static isValidValue(value)
  {
    return typeof value === "object" && !Array.isArray(value) && !ArrayBuffer.isView(value);
  }

  /**
   * Instance shortcut to get.
   * @cjs
   */
  Get(target, key, options)
  {
    return this.constructor.get(target, key, options);
  }

  /**
   * Instance shortcut to set.
   * @cjs
   */
  Set(target, key, value, options)
  {
    return this.constructor.set(target, key, value, options);
  }

  /**
   * Instance shortcut to isValidValue.
   * @cjs
   */
  IsValidValue(value)
  {
    return this.constructor.isValidValue(value);
  }

  /** Stable class identity. */
  static className = "CjsGraphTypeObject";

}
