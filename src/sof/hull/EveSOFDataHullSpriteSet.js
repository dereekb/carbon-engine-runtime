import { exposure as be } from "#be";
import { IRoot } from "../../blue/exposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type } from "#schema";
import { BlueList } from "#blue";
import { EveSOFDataHullSpriteSetItem } from "./EveSOFDataHullSpriteSetItem.js";

/** Groups named sprite items with visibility and skinning policy. */
@be.define({
  name: "EveSOFDataHullSpriteSet",
  inherit: [ IRoot ],
  // EveSOFData_Blue.cpp:466-472, in Carbon's order.
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "skinned", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "visibilityGroup", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "items", be.READ | be.PERSIST ]
  ]
})
export class EveSOFDataHullSpriteSet extends IRoot
{

  /** m_name (std::string) [READWRITE, PERSIST] */

  @type.string
  name = "";

  /** m_skinned (bool) [READWRITE, PERSIST] */

  @type.boolean
  skinned = false;

  /** m_visibilityGroup (BlueSharedString) [READWRITE, PERSIST] */

  @type.string
  visibilityGroup = "primary";

  /** m_items (PEveSOFDataHullSpriteSetItemVector) [READ, PERSIST] */

  @type.list("EveSOFDataHullSpriteSetItem")
  items = new BlueList(EveSOFDataHullSpriteSetItem, { className: "EveSOFDataHullSpriteSetItem" });

}
