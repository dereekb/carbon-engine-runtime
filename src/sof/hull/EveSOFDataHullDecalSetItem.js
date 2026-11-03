import { exposure as be } from "#be";
import { IRoot } from "../../blue/blueexposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type } from "#schema";
import { blue, EnumRegistrationType } from "#blue";
import { EveSOFDataFactionColorSet } from "../faction/EveSOFDataFactionColorSet.js";
import { EveSOFDataLogoSet } from "../shared/EveSOFDataLogoSet.js";
import { quat } from "#math/quat";
import { vec3 } from "#math/vec3";

/** Defines a logo or usage decal with faction color, bone and transform placement, mesh and material data, and single- or multi-hull index buffers. */
@be.define({
  name: "EveSOFDataHullDecalSetItem",
  inherit: [ IRoot ],
  // EveSOFData_Blue.cpp:1041-1055, in Carbon's order.
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR_CHOOSER, "usage", be.READWRITE | be.PERSIST | be.ENUM, "trinity.EveSOFDataHullDecalSetItem.Usage" ],
    [ be.ATTR, "position", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "rotation", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "scaling", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "boneIndex", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "meshIndex", be.READWRITE | be.PERSIST ],
    [ be.ATTR_CHOOSER, "glowColorType", be.READWRITE | be.PERSIST | be.ENUM, "trinity.SOFDataFactionColorChooser.ColorType" ],
    [ be.ATTR_CHOOSER, "logoType", be.READWRITE | be.PERSIST | be.ENUM, "trinity.EveSOFDataLogoSet.LogoType" ],
    [ be.ATTR, "parameters", be.READ | be.PERSIST ],
    [ be.ATTR, "textures", be.READ | be.PERSIST ],
    [ be.ATTR, "indexBuffers", be.READ | be.PERSIST ],
    [ be.ATTR, "multiHullIndexBuffers", be.READ | be.PERSIST ]
  ]
})
export class EveSOFDataHullDecalSetItem extends IRoot
{
  static ColorType = EveSOFDataFactionColorSet.ColorType;

  static LogoType = EveSOFDataLogoSet.LogoType;


  static Usage = {
    USAGE_STANDARD: 0,
    USAGE_KILLCOUNTER: 1,
    USAGE_HOLE: 2,
    USAGE_CYLINDRICAL: 3,
    USAGE_GLOWCYLINDRICAL: 4,
    USAGE_GLOWSTANDARD: 5,
    USAGE_LOGO: 6,
    USAGE_MAX: 7
  };

  /**
   * m_logoType (EveSOFDataLogoSet::LogoType - enum LogoType) [READWRITE, PERSIST, ENUM]
   * Carbon: MAP_ATTRIBUTE_WITH_CHOOSER (trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue.cpp:1051); chooser EveSOFDataLogoSetTypeChooser (trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue.cpp:60).
   */
  @type.int32
  @type.enum("trinity.EveSOFDataLogoSet.LogoType")
  logoType = 0;

  /**
   * m_usage (Usage - enum Usage) [READWRITE, PERSIST, ENUM]
   * Carbon: MAP_ATTRIBUTE_WITH_CHOOSER (trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue.cpp:1044); chooser EveSOFDecalUsageChooser (trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue.cpp:1028).
   */
  @type.int32
  @type.enum("trinity.EveSOFDataHullDecalSetItem.Usage")
  usage = 0;

  /**
   * m_glowColorType (SOFDataFactionColorChooser::ColorType - enum ColorType) [READWRITE, PERSIST, ENUM]
   * Carbon: MAP_ATTRIBUTE_WITH_CHOOSER (trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue.cpp:1050); chooser EveSOFDataFactionColorSetTypeChooser (trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue.cpp:10).
   */
  @type.int32
  @type.enum("trinity.SOFDataFactionColorChooser.ColorType")
  glowColorType = 0;

  /** m_boneIndex (int32_t) [READWRITE, PERSIST] */

  @type.int32
  boneIndex = -1;

  /** m_parameters (PEveSOFDataParameterVector) [READ, PERSIST] */

  @type.list("EveSOFDataParameter")
  parameters = [];

  /** m_textures (PEveSOFDataTextureVector) [READ, PERSIST] */

  @type.list("EveSOFDataTexture")
  textures = [];

  /** m_indexBuffers (PEveSOFDataDecalIndexBufferVector) [READ, PERSIST] */

  @type.list("EveSOFDataDecalIndexBuffer")
  indexBuffers = [];

  /** m_multiHullIndexBuffers (PEveSOFDataMultiHullDecalIndexBuffersVector) [READ, PERSIST] */

  @type.list("EveSOFDataMultiHullDecalIndexBuffers")
  multiHullIndexBuffers = [];

  /** m_name (std::string) [READWRITE, PERSIST] */

  @type.string
  name = "";

  /** m_position (Vector3) [READWRITE, PERSIST] */

  @type.vec3
  position = vec3.create();

  /** m_rotation (Quaternion) [READWRITE, PERSIST] */

  @type.quat
  rotation = quat.create();

  /** m_scaling (Vector3) [READWRITE, PERSIST] */

  @type.vec3
  scaling = vec3.fromValues(1, 1, 1);

  /** m_meshIndex (int32_t) [READWRITE, PERSIST] */

  @type.int32
  meshIndex = -1;

}

// Native chooser labels and selection; the enum object retains all C++ members.
blue.enums.Create("trinity.EveSOFDataHullDecalSetItem.Usage", EveSOFDataHullDecalSetItem.Usage, {
  exposedName: "DecalUsage", exposure: EnumRegistrationType.ENUM_REG_ENUM_OBJECT_ON_MODULE,
  chooser: [
    { name: "Standard", value: EveSOFDataHullDecalSetItem.Usage.USAGE_STANDARD, description: "Standard decal" },
    { name: "KillCounter", value: EveSOFDataHullDecalSetItem.Usage.USAGE_KILLCOUNTER, description: "The killcounter decal" },
    { name: "Hole", value: EveSOFDataHullDecalSetItem.Usage.USAGE_HOLE, description: "Hole decal" },
    { name: "Cylindrical", value: EveSOFDataHullDecalSetItem.Usage.USAGE_CYLINDRICAL, description: "Cylindrical decal" },
    { name: "GlowCylindrical", value: EveSOFDataHullDecalSetItem.Usage.USAGE_GLOWCYLINDRICAL, description: "Glow cylindrical decal" },
    { name: "Glow", value: EveSOFDataHullDecalSetItem.Usage.USAGE_GLOWSTANDARD, description: "Glow decal" },
    { name: "Logo", value: EveSOFDataHullDecalSetItem.Usage.USAGE_LOGO, description: "Logo decal" }
  ]
});
