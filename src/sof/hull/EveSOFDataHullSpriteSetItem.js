import { exposure as be } from "#be";
import { IRoot } from "../../blue/exposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type } from "#schema";
import { EveSOFDataFactionColorSet } from "../faction/EveSOFDataFactionColorSet.js";
import { vec3 } from "#math/vec3";

/** Defines a faction-aware sprite with bone-relative position, blink, scale, falloff, intensity, saturation, and point-light data. */
@be.define({
  name: "EveSOFDataHullSpriteSetItem",
  inherit: [ IRoot ],
  // EveSOFData_Blue.cpp:445-458, in Carbon's order.
  members: [
    [ be.ATTR, "position", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "blinkRate", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "blinkPhase", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "minScale", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "maxScale", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "falloff", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "intensity", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "boneIndex", be.READWRITE | be.PERSIST ],
    [ be.ATTR_CHOOSER, "colorType", be.READWRITE | be.PERSIST | be.ENUM, "trinity.SOFDataFactionColorChooser.ColorType" ],
    [ be.ATTR, "saturation", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "light", be.READWRITE | be.PERSIST ]
  ]
})
export class EveSOFDataHullSpriteSetItem extends IRoot
{
  static ColorType = EveSOFDataFactionColorSet.ColorType;


  /**
   * m_colorType (SOFDataFactionColorChooser::ColorType - enum ColorType) [READWRITE, PERSIST, ENUM]
   * Carbon: MAP_ATTRIBUTE_WITH_CHOOSER (trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue.cpp:456); chooser EveSOFDataFactionColorSetTypeChooser (trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue.cpp:10).
   */
  @type.int32
  @type.enum("trinity.SOFDataFactionColorChooser.ColorType")
  colorType = 0;

  /** m_boneIndex (int32_t) [READWRITE, PERSIST] */

  @type.int32
  boneIndex = 0;

  /** m_position (Vector3) [READWRITE, PERSIST] */

  @type.vec3
  position = vec3.create();

  /** m_blinkRate (float) [READWRITE, PERSIST] */

  @type.float32
  blinkRate = 0.1;

  /** m_blinkPhase (float) [READWRITE, PERSIST] */

  @type.float32
  blinkPhase = 0;

  /** m_minScale (float) [READWRITE, PERSIST] */

  @type.float32
  minScale = 1;

  /** m_maxScale (float) [READWRITE, PERSIST] */

  @type.float32
  maxScale = 10;

  /** m_falloff (float) [READWRITE, PERSIST] */

  @type.float32
  falloff = 0;

  /** m_intensity (float) [READWRITE, PERSIST] */

  @type.float32
  intensity = 1;

  /** m_saturation (float) [READWRITE, PERSIST] */

  @type.float32
  saturation = 1;

  /** m_light (EveSOFDataPointLightAttachmentPtr) [READWRITE, PERSIST] */

  @type.object.ref("EveSOFDataPointLightAttachment")
  light = null;

}
