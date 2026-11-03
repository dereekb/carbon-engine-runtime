import { exposure as be } from "#be";
import { IRoot } from "../../blue/blueexposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type } from "#schema";
import { vec4 } from "#math/vec4";

/** Names a faction spotlight-set group and supplies its cone, sprite, and flare colors. */
@be.define({
  name: "EveSOFDataFactionSpotlightSet",
  inherit: [ IRoot ],
  // EveSOFData_Blue.cpp:417-424, in Carbon's order.
  members: [
    [ be.ATTR, "groupIndex", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "coneColor", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "spriteColor", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "flareColor", be.READWRITE | be.PERSIST ]
  ]
})

export class EveSOFDataFactionSpotlightSet extends IRoot
{

  /** m_groupIndex (int32_t) [READWRITE, PERSIST] */

  @type.int32
  groupIndex = -1;

  /** m_name (std::string) [READWRITE, PERSIST] */

  @type.string
  name = "";

  /** m_coneColor (Color) [READWRITE, PERSIST] */

  @type.color
  coneColor = vec4.create();

  /** m_spriteColor (Color) [READWRITE, PERSIST] */

  @type.color
  spriteColor = vec4.create();

  /** m_flareColor (Color) [READWRITE, PERSIST] */

  @type.color
  flareColor = vec4.create();

}
