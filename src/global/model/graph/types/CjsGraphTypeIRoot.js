import { CjsGraph } from "../CjsGraph.js";
import { CjsGraphTypeObject } from "./CjsGraphTypeObject.js";

/**
 * Explicit IROOT definition: an embedded object, which keeps its identity.
 * Carbon: Be::IROOT (blueexposure/BlueVariable.cpp:274-343).
 * @cjs An embedded object keeps its identity; Set reads into it.
 */
export class CjsGraphTypeIRoot extends CjsGraphTypeObject
{

  /** Distinct definition name. */
  name = "IRoot";

  /**
   * Reads values into the embedded object. A null is no change; a member holding nothing
   * gets a new object.
   * Modelled on: Blue::DictReader::ReadIRoot.
   * @cjs A live object is copied by its values; a _ref fills once every source is read.
   */
  static set(target, key, value, options)
  {
    if (value === null) return false;

    const type = options.member.edge.type;

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
