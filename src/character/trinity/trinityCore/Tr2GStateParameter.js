// Source: trinity/trinity/Tr2GStateParameter.h
import { exposure as be } from "#be";
import { type } from "#schema";
import { IInitialize } from "#blueexposure/IInitialize";

/** Named, node-scoped scalar value for a character GState animation. */
@be.define({
  name: "Tr2GStateParameter",
  // Tr2GStateParameter_Blue.cpp:13-38, in Carbon's order.
  interfaces: [ IInitialize ],
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "value", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "nodename", be.READWRITE | be.PERSIST ],
    [ be.METHOD, "SetName", be.WRAP ],
    [ be.METHOD, "SetValue", be.WRAP ],
    [ be.METHOD, "GetName", be.WRAP ],
    [ be.METHOD, "GetValue", be.WRAP ],
    [ be.METHOD, "SetNodeName", be.WRAP ],
    [ be.METHOD, "GetNodeName", be.WRAP ]
  ]
})
export class Tr2GStateParameter extends IInitialize
{

  /** m_name (std::string) [READWRITE, PERSIST] */
  @type.string
  name = "";

  /** m_value (float) [READWRITE, PERSIST] */
  @type.float32
  value = 0;

  /** m_nodeName (std::string) [READWRITE, PERSIST] */
  @type.string
  nodename = "";

  /**
   * Carbon method GetName (MAP_METHOD_AND_WRAP).
   *
   * @implemented
   */
  GetName()
  {
    return this.name;
  }

  /**
   * Carbon method GetNodeName (MAP_METHOD_AND_WRAP).
   *
   * @implemented
   */
  GetNodeName()
  {
    return this.nodename;
  }

  /**
   * Carbon method GetValue (MAP_METHOD_AND_WRAP).
   *
   * @implemented
   */
  GetValue()
  {
    return this.value;
  }

  /**
   * Carbon method SetName (MAP_METHOD_AND_WRAP).
   *
   * @implemented
   */
  SetName(name)
  {
    this.name = String(name ?? "");
  }

  /**
   * Carbon method SetNodeName (MAP_METHOD_AND_WRAP).
   *
   * @implemented
   */
  SetNodeName(name)
  {
    this.nodename = String(name ?? "");
  }

  /**
   * Carbon method SetValue (MAP_METHOD_AND_WRAP).
   *
   * @implemented
   */
  SetValue(value)
  {
    this.value = Number(value);
  }

  /**
   * Reports successful portable initialization for the persisted parameter
   * record.
   *
   * @implemented
   */
  Initialize()
  {
    return true;
  }

}

