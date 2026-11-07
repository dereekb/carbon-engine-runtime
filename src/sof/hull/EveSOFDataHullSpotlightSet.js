import { exposure as be } from "#be";
import { IRoot } from "../../blue/exposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type } from "#schema";
import { BlueList } from "#blue";
import { EveSOFDataHullSpotlightSetItem } from "./EveSOFDataHullSpotlightSetItem.js";

/** Groups spotlight items with cone, glow, and flare textures plus skinning, depth, and visibility policy. */
@be.define({
  name: "EveSOFDataHullSpotlightSet",
  inherit: [ IRoot ],
  // EveSOFData_Blue.cpp:330-339, in Carbon's order.
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "visibilityGroup", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "skinned", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "zOffset", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "coneTextureResPath", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "glowTextureResPath", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "items", be.READ | be.PERSIST ]
  ]
})
export class EveSOFDataHullSpotlightSet extends IRoot
{

  /** m_name (std::string) [READWRITE, PERSIST] */

  @type.string
  name = "";

  /** m_skinned (bool) [READWRITE, PERSIST] */

  @type.boolean
  skinned = false;

  /** m_zOffset (float) [READWRITE, PERSIST] */

  @type.float32
  zOffset = 0;

  /** m_coneTextureResPath (std::string) [READWRITE, PERSIST] */

  @type.path("TriTextureRes")
  coneTextureResPath = "";

  /** m_glowTextureResPath (std::string) [READWRITE, PERSIST] */

  @type.path("TriTextureRes")
  glowTextureResPath = "";

  /** m_visibilityGroup (BlueSharedString) [READWRITE, PERSIST] */

  @type.string
  visibilityGroup = "primary";

  /** m_items (PEveSOFDataHullSpotlightSetItemVector) [READ, PERSIST] */

  @type.list("EveSOFDataHullSpotlightSetItem")
  items = new BlueList(EveSOFDataHullSpotlightSetItem, { className: "EveSOFDataHullSpotlightSetItem" });

}
