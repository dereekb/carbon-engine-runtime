import { exposure as be } from "#be";
import { IRoot } from "../../blue/exposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type } from "#schema";
import { blue, EnumRegistrationType } from "#blue";
import { vec2 } from "#math/vec2";

/** Groups plane items with usage, texture, atlas, visibility, and skinning policy. */
@be.define({
  name: "EveSOFDataHullPlaneSet",
  inherit: [ IRoot ],
  // EveSOFData_Blue.cpp:385-398, in Carbon's order.
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "visibilityGroup", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "layer1MapResPath", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "layer2MapResPath", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "maskMapResPath", be.READWRITE | be.PERSIST ],
    [ be.ATTR_CHOOSER, "usage", be.READWRITE | be.PERSIST | be.ENUM, "trinity.EveSOFDataHullPlaneSet.Usage" ],
    [ be.ATTR, "atlasSize", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "atlasAspectRatio", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "skinned", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "items", be.READ | be.PERSIST ]
  ]
})
export class EveSOFDataHullPlaneSet extends IRoot
{

  /**
   * m_usage (Usage - enum Usage) [READWRITE, PERSIST, ENUM]
   * Carbon: MAP_ATTRIBUTE_WITH_CHOOSER (trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue.cpp:393); chooser EveSOFDataHullPlaneSetUsageChooser (trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue.cpp:375).
   */
  @type.int32
  @type.enum("trinity.EveSOFDataHullPlaneSet.Usage")
  usage = 0;

  /** m_name (std::string) [READWRITE, PERSIST] */

  @type.string
  name = "";

  /** m_layer1MapResPath (std::string) [READWRITE, PERSIST] */

  @type.path("TriTextureRes")
  layer1MapResPath = "";

  /** m_layer2MapResPath (std::string) [READWRITE, PERSIST] */

  @type.path("TriTextureRes")
  layer2MapResPath = "";

  /** m_maskMapResPath (std::string) [READWRITE, PERSIST] */

  @type.path("TriTextureRes")
  maskMapResPath = "";

  /** m_skinned (bool) [READWRITE, PERSIST] */

  @type.boolean
  skinned = false;

  /** m_atlasAspectRatio (Vector2) [READWRITE, PERSIST] */

  @type.vec2
  atlasAspectRatio = vec2.fromValues(1, 1);

  /** m_visibilityGroup (BlueSharedString) [READWRITE, PERSIST] */

  @type.string
  visibilityGroup = "primary";

  /** m_atlasSize (uint32_t) [READWRITE, PERSIST] */

  @type.uint32
  atlasSize = 1;

  /** m_items (PEveSOFDataHullPlaneSetItemVector) [READ, PERSIST] */

  @type.list("EveSOFDataHullPlaneSetItem")
  items = [];

  static Usage = {
    USAGE_STANDARD: 0,
    USAGE_SPACE_VIDEO: 2,
    USAGE_HANGAR_VIDEO: 3,
    USAGE_HAZE: 5
  };

}

// Native chooser labels and selection; the enum object retains all C++ members.
blue.enums.Create("trinity.EveSOFDataHullPlaneSet.Usage", EveSOFDataHullPlaneSet.Usage, {
  exposedName: "HullPlanesetUsage", exposure: EnumRegistrationType.ENUM_REG_ENUM_OBJECT_ON_MODULE,
  chooser: [
    { name: "Standard", value: EveSOFDataHullPlaneSet.Usage.USAGE_STANDARD, description: "Standard planeset" },
    { name: "SpaceVideo", value: EveSOFDataHullPlaneSet.Usage.USAGE_SPACE_VIDEO, description: "Space Video planeset" },
    { name: "HangarVideo", value: EveSOFDataHullPlaneSet.Usage.USAGE_HANGAR_VIDEO, description: "Hangar Video planeset" },
    { name: "Haze", value: EveSOFDataHullPlaneSet.Usage.USAGE_HAZE, description: "Fake haze planeset" }
  ]
});
