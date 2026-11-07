import { exposure as be } from "#be";
import { IRoot } from "../../blue/exposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type } from "#schema";
import { EveSOFDataArea } from "../shared/EveSOFDataArea.js";
import { BlueList } from "#blue";
import { EveSOFDataParameter } from "../shared/EveSOFDataParameter.js";
import { EveSOFDataTexture } from "../shared/EveSOFDataTexture.js";

/** Carbon-authored hull mesh-area record. */
@be.define({
  name: "EveSOFDataHullArea",
  inherit: [ IRoot ],
  // EveSOFData_Blue.cpp:765-775, in Carbon's order.
  members: [
    [ be.ATTR, "index", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "count", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "shader", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "blockedMaterials", be.READWRITE | be.PERSIST ],
    [ be.ATTR_CHOOSER, "areaType", be.READWRITE | be.PERSIST | be.ENUM, "trinity.EveSOFDataArea.AreaType" ],
    [ be.ATTR, "textures", be.READ | be.PERSIST ],
    [ be.ATTR, "parameters", be.READ | be.PERSIST ]
  ]
})
export class EveSOFDataHullArea extends IRoot
{
  static AreaType = EveSOFDataArea.AreaType;


  /**
   * m_areaType (EveSOFDataArea::AreaType - enum AreaType) [READWRITE, PERSIST, ENUM]
   * Carbon: MAP_ATTRIBUTE_WITH_CHOOSER (trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue.cpp:773); chooser EveSOFDataAreaTypeChooser (trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue.cpp:113).
   */
  @type.int32
  @type.enum("trinity.EveSOFDataArea.AreaType")
  areaType = 0;

  /** m_textures (PEveSOFDataTextureVector) [READ, PERSIST] */

  @type.list("EveSOFDataTexture")
  textures = new BlueList(EveSOFDataTexture, { className: "EveSOFDataTexture" });

  /** m_parameters (PEveSOFDataParameterVector) [READ, PERSIST] */

  @type.list("EveSOFDataParameter")
  parameters = new BlueList(EveSOFDataParameter, { className: "EveSOFDataParameter" });

  /** m_index (uint32_t) [READWRITE, PERSIST] */

  @type.uint32
  index = 0;

  /** m_count (uint32_t) [READWRITE, PERSIST] */

  @type.uint32
  count = 1;

  /** m_name (BlueSharedString) [READWRITE, PERSIST] */

  @type.string
  name = "";

  /** m_shader (BlueSharedString) [READWRITE, PERSIST] */

  @type.string
  shader = "";

  /** m_blockedMaterials (uint32_t) [READWRITE, PERSIST] */

  @type.uint32
  blockedMaterials = 0;

  /**
   * Populates a mesh-area configuration with this record's authored texture and
   * parameter values.
   */
  Assign(config = {})
  {
    config.textures = this.AssignTextures(config.textures ?? {});
    config.parameters = this.AssignParameters(config.parameters ?? {});
    return config;
  }

  /** Writes every authored mesh-area parameter into the supplied map. */
  AssignParameters(out)
  {
    for (const parameter of this.parameters) parameter.Assign(out);
    return out;
  }

  /** Writes every authored mesh-area texture path into the supplied map. */
  AssignTextures(out)
  {
    for (const texture of this.textures) texture.Assign(out);
    return out;
  }

}
