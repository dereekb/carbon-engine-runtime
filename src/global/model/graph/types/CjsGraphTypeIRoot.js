import { CjsGraph } from "../CjsGraph.js";
import { CjsGraphTypeObject } from "./CjsGraphTypeObject.js";

/**
 * IROOT members: an embedded object, or a struct written and read as one.
 * Modelled on: Be::IROOT (blueexposure/BlueVariable.cpp:338-343).
 * @cjs A held object keeps its identity, so a value is read into it.
 */
export class CjsGraphTypeIRoot extends CjsGraphTypeObject
{

  /**
   * Reads values into the embedded object. A null is no change; a member holding nothing
   * gets a new object.
   * Modelled on: Blue::DictReader::ReadIRoot.
   * @cjs A live object is copied by its values; a _ref fills once every source is read.
   */
  Set(target, key, value, member, options)
  {
    if (value === null) return false;

    const type = member.edgeType;

    if (CjsGraph.isReference(value))
    {
      target[key] ??= CjsGraph.createObject({}, type, options);
      options.deferred = CjsGraph.deferValues(target[key], value, type, options);
      return true;
    }

    const values = CjsGraph.getEmbeddedValues(value, options);

    if (target[key] !== null) return CjsGraph.setObject(target[key], values, type, options);

    target[key] = CjsGraph.createObject(values, type, options);
    return target[key];
  }

  /** Stable class identity. */
  static className = "CjsGraphTypeIRoot";

}
