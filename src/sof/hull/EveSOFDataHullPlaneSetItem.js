import { exposure as be } from "#be";
import { IRoot } from "../../blue/blueexposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type, blue } from "#schema";
import { EveSOFDataBlinkType } from "../shared/EveSOFDataBlinkType.js";
import { EveSOFDataFactionColorSet } from "../faction/EveSOFDataFactionColorSet.js";
import { quat } from "#math/quat";
import { vec3 } from "#math/vec3";
import { vec4 } from "#math/vec4";

/** Defines a plane item's transform, colors, blink and UV scrolling, atlas selection, groups, intensity, and point-light contribution. */
@be.define({
  name: "EveSOFDataHullPlaneSetItem",
  inherit: [ IRoot ],
  // EveSOFData_Blue.cpp:347-367, in Carbon's order.
  members: [
    [ be.ATTR, "position", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "rotation", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "scaling", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "color", be.READWRITE | be.PERSIST ],
    [ be.ATTR_CHOOSER, "colorType", be.READWRITE | be.PERSIST | be.ENUM, "trinity.SOFDataFactionColorChooser.ColorType" ],
    [ be.ATTR, "intensity", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "saturation", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "layer1Transform", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "layer1Scroll", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "layer2Transform", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "layer2Scroll", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "boneIndex", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "groupIndex", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "maskMapAtlasIndex", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "blinkRate", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "blinkPhase", be.READWRITE | be.PERSIST ],
    [ be.ATTR_CHOOSER, "blinkMode", be.READWRITE | be.PERSIST | be.ENUM, "trinity.EveSOFDataBlinkType.BlinkType" ],
    [ be.ATTR, "lights", be.READ | be.PERSIST ]
  ]
})
export class EveSOFDataHullPlaneSetItem extends IRoot
{
  static BlinkType = EveSOFDataBlinkType.BlinkType;

  static ColorType = EveSOFDataFactionColorSet.ColorType;


  /**
   * m_blinkMode (int32_t) [READWRITE, PERSIST, ENUM]
   * Carbon: MAP_ATTRIBUTE_WITH_CHOOSER (trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue.cpp:366); chooser EveSOFDataPlaneSetBlinkTypeChooser (trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue.cpp:70).
   */
  @type.int32
  @type.enum("trinity.EveSOFDataBlinkType.BlinkType")
  blinkMode = 0;

  /**
   * m_colorType (SOFDataFactionColorChooser::ColorType - enum ColorType) [READWRITE, PERSIST, ENUM]
   * Carbon: MAP_ATTRIBUTE_WITH_CHOOSER (trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue.cpp:354); chooser EveSOFDataFactionColorSetTypeChooser (trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue.cpp:10).
   */
  @type.int32
  @type.enum("trinity.SOFDataFactionColorChooser.ColorType")
  colorType = 0;

  /** m_boneIndex (int32_t) [READWRITE, PERSIST] */

  @type.int32
  boneIndex = -1;

  /** m_position (Vector3) [READWRITE, PERSIST] */

  @type.vec3
  position = vec3.create();

  /** m_rotation (Quaternion) [READWRITE, PERSIST] */

  @type.quat
  rotation = quat.create();

  /** m_scaling (Vector3) [READWRITE, PERSIST] */

  @type.vec3
  scaling = vec3.fromValues(1, 1, 1);

  /** m_color (Color) [READWRITE, PERSIST] */

  @type.color
  color = vec4.fromValues(1, 1, 1, 1);

  /** m_layer1Transform (Vector4) [READWRITE, PERSIST] */

  @type.vec4
  layer1Transform = vec4.create();

  /** m_layer1Scroll (Vector4) [READWRITE, PERSIST] */

  @type.vec4
  layer1Scroll = vec4.create();

  /** m_layer2Transform (Vector4) [READWRITE, PERSIST] */

  @type.vec4
  layer2Transform = vec4.create();

  /** m_layer2Scroll (Vector4) [READWRITE, PERSIST] */

  @type.vec4
  layer2Scroll = vec4.create();

  /** m_groupIndex (int32_t) [READWRITE, PERSIST] */

  @type.int32
  groupIndex = -1;

  /** m_maskMapAtlasIndex (int32_t) [READWRITE, PERSIST] */

  @type.int32
  maskMapAtlasIndex = 0;

  /** m_phase (float) [READWRITE, PERSIST] */

  @type.float32
  blinkPhase = 0;

  /** m_rate (float) [READWRITE, PERSIST] */

  @type.float32
  blinkRate = 1;

  /** m_dutyCycle (float) - runtime-only Carbon field; not exposed to Blue. */
  dutyCycle = 1;

  /** m_lights (PEveSOFDataPointLightAttachmentVector) [READ, PERSIST] */

  @type.list("EveSOFDataPointLightAttachment")
  lights = [];

  /** m_intensity (float) [READWRITE, PERSIST] */

  @type.float32
  intensity = 1;

  /** m_saturation (float) [READWRITE, PERSIST] */

  @type.float32
  saturation = 1;

}
