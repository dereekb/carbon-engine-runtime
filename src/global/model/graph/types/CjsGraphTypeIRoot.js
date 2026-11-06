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
   * @cjs A live object or known _ref is copied by its values.
   */
  static set(target, key, value, options)
  {
    if (value === null) return false;

    const type = options.member.edge.type;
    const values = CjsGraph.getEmbeddedValues(value, options);

    if (target[key] !== null) return CjsGraph.setObject(target[key], values, type, options);

    target[key] = CjsGraph.createObject(values, type, options);
    return target[key];
  }

  /** Stable class identity. */
  static className = "CjsGraphTypeIRoot";

}
