import { exposure as be } from "#be";
import { IRoot } from "../../blue/blueexposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type, blue } from "#schema";

/** Names a faction child and records its group and visibility settings. */
@be.define({
  name: "EveSOFDataFactionChild",
  inherit: [ IRoot ],
  // EveSOFData_Blue2.cpp:80-85, in Carbon's order.
  members: [
    [ be.ATTR, "groupIndex", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "isVisible", be.READWRITE | be.PERSIST ]
  ]
})

export class EveSOFDataFactionChild extends IRoot
{

  /** m_groupIndex (int32_t) [READWRITE, PERSIST] */

  @type.int32
  groupIndex = -1;

  /** m_name (std::string) [READWRITE, PERSIST] */

  @type.string
  name = "";

  /** m_isVisible (bool) [READWRITE, PERSIST] */

  @type.boolean
  isVisible = false;

}
