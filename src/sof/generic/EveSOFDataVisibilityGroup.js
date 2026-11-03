import { exposure as be } from "#be";
import { IRoot } from "../../blue/exposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue2.cpp:418-427
import { type } from "#schema";

/** Names and describes a generic visibility group.
 * Native IRoot-only data with a self-only Blue table. Field initializers
 * preserve native defaults; no initialization, update or resource lifecycle
 * is required, and the native destructor is empty.
 */
@be.define({
  name: "EveSOFDataVisibilityGroup",
  inherit: [ IRoot ],
  // EveSOFData_Blue2.cpp:420-424, in Carbon's order.
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "description", be.READWRITE | be.PERSIST ]
  ]
})

export class EveSOFDataVisibilityGroup extends IRoot
{

  /** m_name (std::string) [READWRITE, PERSIST] */

  @type.string
  name = "";

  /** m_description (std::string) [READWRITE, PERSIST] */

  @type.string
  description = "";

}

