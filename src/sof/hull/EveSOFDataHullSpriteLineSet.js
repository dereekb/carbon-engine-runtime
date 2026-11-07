import { exposure as be } from "#be";
import { IRoot } from "../../blue/exposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type } from "#schema";
import { BlueList } from "#blue";
import { EveSOFDataHullSpriteLineSetItem } from "./EveSOFDataHullSpriteLineSetItem.js";

/** Groups named sprite-line items with visibility and skinning policy. */
@be.define({
  name: "EveSOFDataHullSpriteLineSet",
  inherit: [ IRoot ],
  // EveSOFData_Blue.cpp:506-512, in Carbon's order.
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "skinned", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "visibilityGroup", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "items", be.READ | be.PERSIST ]
  ]
})
export class EveSOFDataHullSpriteLineSet extends IRoot
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

  /** m_items (PEveSOFDataHullSpriteLineSetItemVector) [READ, PERSIST] */

  @type.list("EveSOFDataHullSpriteLineSetItem")
  items = new BlueList(EveSOFDataHullSpriteLineSetItem, { className: "EveSOFDataHullSpriteLineSetItem" });

}
