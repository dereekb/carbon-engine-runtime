import { exposure as be } from "#be";
import { IRoot } from "../../blue/blueexposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type, blue } from "#schema";

/** Stores the hull, faction, race, pattern, and layout selections encoded by one parsed SOF DNA value. */
@be.define({
  name: "EveSOFDNADescriptor",
  inherit: [ IRoot ],
  // EveSOFData_Blue2.cpp:394-404, in Carbon's order.
  members: [
    [ be.ATTR, "hull", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "faction", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "race", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "layout", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "pattern", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "material1", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "material2", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "material3", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "material4", be.READWRITE | be.PERSIST ]
  ]
})

export class EveSOFDNADescriptor extends IRoot
{

  /** m_material1 (std::string) [READWRITE, PERSIST] */

  @type.string
  material1 = "";

  /** m_material2 (std::string) [READWRITE, PERSIST] */

  @type.string
  material2 = "";

  /** m_material3 (std::string) [READWRITE, PERSIST] */

  @type.string
  material3 = "";

  /** m_material4 (std::string) [READWRITE, PERSIST] */

  @type.string
  material4 = "";

  /** m_faction (std::string) [READWRITE, PERSIST] */

  @type.string
  faction = "";

  /** m_hull (std::string) [READWRITE, PERSIST] */

  @type.string
  hull = "";

  /** m_layout (std::string) [READWRITE, PERSIST] */

  @type.string
  layout = "";

  /** m_pattern (std::string) [READWRITE, PERSIST] */

  @type.string
  pattern = "";

  /** m_race (std::string) [READWRITE, PERSIST] */

  @type.string
  race = "";

}
