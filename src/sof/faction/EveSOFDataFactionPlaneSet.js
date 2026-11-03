import { exposure as be } from "#be";
import { IRoot } from "../../blue/exposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type } from "#schema";
import { vec4 } from "#math/vec4";

/** Names a faction plane-set group and supplies its color. */
@be.define({
  name: "EveSOFDataFactionPlaneSet",
  inherit: [ IRoot ],
  // EveSOFData_Blue.cpp:432-437, in Carbon's order.
  members: [
    [ be.ATTR, "groupIndex", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "color", be.READWRITE | be.PERSIST ]
  ]
})

export class EveSOFDataFactionPlaneSet extends IRoot
{

  /** m_groupIndex (int32_t) [READWRITE, PERSIST] */

  @type.int32
  groupIndex = -1;

  /** m_name (std::string) [READWRITE, PERSIST] */

  @type.string
  name = "";

  /** m_color (Color) [READWRITE, PERSIST] */

  @type.color
  color = vec4.create();

}
