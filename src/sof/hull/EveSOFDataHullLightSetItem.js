import { exposure as be } from "#be";
import { IRoot } from "../../blue/blueexposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type, blue } from "#schema";
import { EveSOFDataFactionColorSet } from "../faction/EveSOFDataFactionColorSet.js";
import { vec3 } from "#math/vec3";

/** Provides the common faction, flag, bone, position, radius, brightness, and noise fields shared by point, textured-point, and spot lights. */
@be.define({
  name: "EveSOFDataHullLightSetItem",
  inherit: [ IRoot ],
  // EveSOFData_Blue.cpp:1062-1074, in Carbon's order.
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR_CHOOSER, "flags", be.READWRITE | be.PERSIST, "trinity.Tr2LightFlags" ],
    [ be.ATTR, "position", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "boneIndex", be.READWRITE | be.PERSIST ],
    [ be.ATTR_CHOOSER, "lightColor", be.READWRITE | be.PERSIST | be.ENUM, "trinity.SOFDataFactionColorChooser.ColorType" ],
    [ be.ATTR, "radius", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "innerRadius", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "brightness", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "noiseAmplitude", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "noiseFrequency", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "noiseOctaves", be.READWRITE | be.PERSIST ]
  ]
})
export class EveSOFDataHullLightSetItem extends IRoot
{
  static ColorType = EveSOFDataFactionColorSet.ColorType;


  /**
   * m_data.lightColor (SOFDataFactionColorChooser::ColorType - enum ColorType) [READWRITE, PERSIST, ENUM]
   * Carbon: MAP_ATTRIBUTE_WITH_CHOOSER (trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue.cpp:1068); chooser EveSOFDataFactionColorSetTypeChooser (trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue.cpp:10).
   */
  @type.int32
  @type.enum("trinity.SOFDataFactionColorChooser.ColorType")
  lightColor = 0;

  /**
   * m_data.flags (uint16_t) [READWRITE, PERSIST]
   * Carbon: MAP_ATTRIBUTE_WITH_CHOOSER (trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue.cpp:1065); chooser Tr2LightFlagChooser (trinity/trinity/Lights/Tr2Light_Blue.cpp:16).
   */
  @type.uint16
  flags = 1;

  /** m_data.boneIndex (int) [READWRITE, PERSIST] */

  @type.int32
  boneIndex = -1;

  /** m_name (std::string) [READWRITE, PERSIST] */

  @type.string
  name = "";

  /** m_data.position (Vector3) [READWRITE, PERSIST] */

  @type.vec3
  position = vec3.create();

  /** m_data.radius (float) [READWRITE, PERSIST] */

  @type.float32
  radius = 0;

  /** m_data.innerRadius (float) [READWRITE, PERSIST] */

  @type.float32
  innerRadius = 0;

  /** m_data.brightness (float) [READWRITE, PERSIST] */

  @type.float32
  brightness = 0;

  /** m_data.noiseAmplitude (float) [READWRITE, PERSIST] */

  @type.float32
  noiseAmplitude = 0;

  /** m_data.noiseFrequency (float) [READWRITE, PERSIST] */

  @type.float32
  noiseFrequency = 1;

  /** m_data.noiseOctaves (int) [READWRITE, PERSIST] */

  @type.int32
  noiseOctaves = 1;

  static LightType = Object.freeze({
    POINT_LIGHT: 0,
    TEXTURED_POINT_LIGHT: 1,
    SPOT_LIGHT: 2
  });

}
