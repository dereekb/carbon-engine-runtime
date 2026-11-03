import { exposure as be } from "#be";
import { IRoot } from "../../blue/blueexposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type, blue } from "#schema";

/** Groups named hull light items and their visibility policy. */
@be.define({
  name: "EveSOFDataHullLightSet",
  inherit: [ IRoot ],
  // EveSOFData_Blue2.cpp:117-121, in Carbon's order.
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "visibilityGroup", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "items", be.READ | be.PERSIST ]
  ]
})
export class EveSOFDataHullLightSet extends IRoot
{

  /** m_name (std::string) [READWRITE, PERSIST] */

  @type.string
  name = "";

  /** m_visibilityGroup (BlueSharedString) [READWRITE, PERSIST] */

  @type.string
  visibilityGroup = "primary";

  /** m_items (PEveSOFDataHullLightSetItemVector) [READ, PERSIST] */

  @type.list("EveSOFDataHullLightSetItem")
  items = [];

}
