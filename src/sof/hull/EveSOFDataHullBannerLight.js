import { exposure as be } from "#be";
import { IRoot } from "../../blue/blueexposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type, blue } from "#schema";

/** Stores the brightness, radius, noise, saturation, and octave tuning for a banner light. */
@be.define({
  name: "EveSOFDataHullBannerLight",
  inherit: [ IRoot ],
  // EveSOFData_Blue.cpp:617-654, in Carbon's order.
  members: [
    [ be.ATTR, "brightness", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "radiusMultiplier", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "innerRadiusMultiplier", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "noiseAmplitude", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "noiseFrequency", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "noiceOctaves", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "saturation", be.READWRITE | be.PERSIST ]
  ]
})
export class EveSOFDataHullBannerLight extends IRoot
{

  /** m_brightness (float) [READWRITE, PERSIST] */

  @type.float32
  brightness = 1;

  /** m_innerRadiusMultiplier (float) [READWRITE, PERSIST] */

  @type.float32
  innerRadiusMultiplier = 0.3;

  /** m_noiseAmplitude (float) [READWRITE, PERSIST] */

  @type.float32
  noiseAmplitude = 0;

  /** m_noiseFrequency (float) [READWRITE, PERSIST] */

  @type.float32
  noiseFrequency = 1;

  /** m_noiseOctaves (int32_t) [READWRITE, PERSIST] */

  @type.int32
  noiceOctaves = 1;

  /** m_saturation (float) [READWRITE, PERSIST] */

  @type.float32
  saturation = 1;

  /** m_radiusMultiplier (float) [READWRITE, PERSIST] */

  @type.float32
  radiusMultiplier = 1;

}
