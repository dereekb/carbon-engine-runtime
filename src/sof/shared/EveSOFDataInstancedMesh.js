import { exposure as be } from "#be";
import { IRoot } from "../../blue/exposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import "#consts/trinity";
import { type } from "#schema";
import { blue, EnumRegistrationType, BlueList } from "#blue";
import { Tr2Lod } from "#consts/trinity";
import { EveSOFDataTexture } from "./EveSOFDataTexture.js";

/** Defines instanced-mesh geometry, shader, display and LOD policy, textures, and instance transforms. */
@be.define({
  name: "EveSOFDataInstancedMesh",
  inherit: [ IRoot ],
  // EveSOFData_Blue2.cpp:65-74, in Carbon's order.
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "lowestLodVisible", be.READWRITE | be.PERSIST ],
    [ be.ATTR_CHOOSER, "displayModifier", be.READWRITE | be.PERSIST | be.ENUM, "trinity.EveSOFDataInstancedMesh.DisplayQualityModifier" ],
    [ be.ATTR, "geometryResPath", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "instances", be.READ | be.PERSIST ],
    [ be.ATTR, "shader", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "textures", be.READ | be.PERSIST ]
  ]
})

export class EveSOFDataInstancedMesh extends IRoot
{
  static Tr2Lod = Tr2Lod;


  /**
   * m_displayModifier (DisplayQualityModifier - enum DisplayQualityModifier) [READWRITE, PERSIST, ENUM]
   * Carbon: MAP_ATTRIBUTE_WITH_CHOOSER (trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue2.cpp:70); chooser DisplayFlagModifierChooser (trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue2.cpp:52).
   */
  @type.int32
  @type.enum("trinity.EveSOFDataInstancedMesh.DisplayQualityModifier")
  displayModifier = 5;

  /** m_instances (PEveSofDataMeshInstanceStructureList) [READ, PERSIST] */

  @type.structList("EveSofDataMeshInstance")
  instances = [];

  /** m_textures (PEveSOFDataTextureVector) [READ, PERSIST] */

  @type.list("EveSOFDataTexture")
  textures = new BlueList(EveSOFDataTexture, { className: "EveSOFDataTexture" });

  /** m_name (BlueSharedString) [READWRITE, PERSIST] */

  @type.string
  name = "";

  /** m_lowestLodVisible (Tr2Lod - enum Tr2Lod) [READWRITE, PERSIST, ENUM] */

  @type.int32
  @type.enum("trinity.Tr2Lod")
  lowestLodVisible = 0;

  /** m_geometryResPath (std::string) [READWRITE, PERSIST] */

  @type.path("TriGeometryRes")
  geometryResPath = "";

  /** m_shader (BlueSharedString) [READWRITE, PERSIST] */

  @type.string
  shader = "";

  static DisplayQualityModifier = {
    SHADER_LOW: 0,
    SHADER_LOWMID: 1,
    SHADER_MED: 2,
    SHADER_HIGHMID: 3,
    SHADER_HIGH: 4,
    SHADER_ALL: 5
  };

}

// Native chooser labels and selection; the enum object retains all C++ members.
blue.enums.Create("trinity.EveSOFDataInstancedMesh.DisplayQualityModifier", EveSOFDataInstancedMesh.DisplayQualityModifier, {
  exposedName: "DisplayModifierChooser", exposure: EnumRegistrationType.ENUM_REG_ENUM_OBJECT_ON_MODULE,
  chooser: [
    { name: "None_", value: EveSOFDataInstancedMesh.DisplayQualityModifier.SHADER_ALL, description: "Visible to users with all shader settings" },
    { name: "Medium_and_High", value: EveSOFDataInstancedMesh.DisplayQualityModifier.SHADER_HIGHMID, description: "Visible for users with shader settings on Medium or High" },
    { name: "Low_and_Medium", value: EveSOFDataInstancedMesh.DisplayQualityModifier.SHADER_LOWMID, description: "Visible for users with shader settings on Low or Medium" },
    { name: "High", value: EveSOFDataInstancedMesh.DisplayQualityModifier.SHADER_HIGH, description: "Only visible for users with shader settings on High" },
    { name: "Medium", value: EveSOFDataInstancedMesh.DisplayQualityModifier.SHADER_MED, description: "Only visible for users with shader settings on Medium" },
    { name: "Low", value: EveSOFDataInstancedMesh.DisplayQualityModifier.SHADER_LOW, description: "Only visible for users with shader settings on Low" }
  ]
});
