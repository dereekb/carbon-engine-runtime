import { exposure as be } from "#be";
import { IRoot } from "../../blue/blueexposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type } from "#schema";
import { EveSOFDataFactionColorSet } from "../faction/EveSOFDataFactionColorSet.js";
import { quat } from "#math/quat";
import { vec3 } from "#math/vec3";

/** Defines a faction-aware haze item with bone-relative transform, brightness, falloff, saturation, booster influence, and point-light data. */
@be.define({
  name: "EveSOFDataHullHazeSetItem",
  inherit: [ IRoot ],
  // EveSOFData_Blue.cpp:520-534, in Carbon's order.
  members: [
    [ be.ATTR, "position", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "scaling", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "rotation", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "boneIndex", be.READWRITE | be.PERSIST ],
    [ be.ATTR_CHOOSER, "colorType", be.READWRITE | be.PERSIST | be.ENUM, "trinity.SOFDataFactionColorChooser.ColorType" ],
    [ be.ATTR, "saturation", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "hazeBrightness", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "hazeFalloff", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "sourceBrightness", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "sourceSize", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "boosterGainInfluence", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "lights", be.READ | be.PERSIST ]
  ]
})
export class EveSOFDataHullHazeSetItem extends IRoot
{
  static ColorType = EveSOFDataFactionColorSet.ColorType;


  /**
   * m_colorType (SOFDataFactionColorChooser::ColorType - enum ColorType) [READWRITE, PERSIST, ENUM]
   * Carbon: MAP_ATTRIBUTE_WITH_CHOOSER (trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue.cpp:527); chooser EveSOFDataFactionColorSetTypeChooser (trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue.cpp:10).
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

  /** m_scaling (Vector3) [READWRITE, PERSIST] */

  @type.vec3
  scaling = vec3.fromValues(1, 1, 1);

  /** m_rotation (Quaternion) [READWRITE, PERSIST] */

  @type.quat
  rotation = quat.create();

  /** m_hazeBrightness (float) [READWRITE, PERSIST] */

  @type.float32
  hazeBrightness = 1;

  /** m_hazeFalloff (float) [READWRITE, PERSIST] */

  @type.float32
  hazeFalloff = 6;

  /** m_sourceBrightness (float) [READWRITE, PERSIST] */

  @type.float32
  sourceBrightness = 2;

  /** m_sourceSize (float) [READWRITE, PERSIST] */

  @type.float32
  sourceSize = 0.2;

  /** m_boosterGainInfluence (bool) [READWRITE, PERSIST] */

  @type.boolean
  boosterGainInfluence = false;

  /** m_lights (PEveSOFDataPointLightAttachmentVector) [READ, PERSIST] */

  @type.list("EveSOFDataPointLightAttachment")
  lights = [];

  /** m_saturation (float) [READWRITE, PERSIST] */

  @type.float32
  saturation = 1;

}
