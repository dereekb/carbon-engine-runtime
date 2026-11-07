import { exposure as be } from "#be";
import { IRoot } from "../../blue/exposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type } from "#schema";
import { BlueList } from "#blue";
import { EveSOFDataHullDecalSetItem } from "./EveSOFDataHullDecalSetItem.js";

/** Groups named decal items and their visibility policy. */
@be.define({
  name: "EveSOFDataHullDecalSet",
  inherit: [ IRoot ],
  // EveSOFData_Blue2.cpp:91-96, in Carbon's order.
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "visibilityGroup", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "items", be.READ | be.PERSIST ]
  ]
})
export class EveSOFDataHullDecalSet extends IRoot
{

  /** m_name (std::string) [READWRITE, PERSIST] */

  @type.string
  name = "";

  /** m_visibilityGroup (BlueSharedString) [READWRITE, PERSIST] */

  @type.string
  visibilityGroup = "primary";

  /** m_items (PEveSOFDataHullDecalSetItemVector) [READ, PERSIST] */

  @type.list("EveSOFDataHullDecalSetItem")
  items = new BlueList(EveSOFDataHullDecalSetItem, { className: "EveSOFDataHullDecalSetItem" });

}
