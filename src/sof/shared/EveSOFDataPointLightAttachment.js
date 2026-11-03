import { exposure as be } from "#be";
import { IRoot } from "../../blue/exposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type } from "#schema";
import { quat } from "#math/quat";
import { vec3 } from "#math/vec3";

/** Defines point-light placement, rotation, intensity, saturation, scale, noise, and profile data for an attachment. */
@be.define({
  name: "EveSOFDataPointLightAttachment",
  inherit: [ IRoot ],
  // EveSOFData_Blue.cpp:272-284, in Carbon's order.
  members: [
    [ be.ATTR, "saturation", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "intensity", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "translation", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "rotation", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "innerScaleMultiplier", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "outerScaleMultiplier", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "noiseAmplitude", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "noiseFrequency", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "noiseOctaves", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "lightProfilePath", be.READWRITE | be.PERSIST ]
  ]
})

export class EveSOFDataPointLightAttachment extends IRoot
{

  /**
   * Color saturation applied to the attachment light.
   * Native m_saturation (float) [READWRITE, PERSIST]
   * @type {number}
   */

  @type.float32
  saturation = 1;

  /**
   * Brightness multiplier applied to the attachment light.
   * Native m_intensity (float) [READWRITE, PERSIST]
   * @type {number}
   */

  @type.float32
  intensity = 1;

  /**
   * Local translation of the light relative to its attachment.
   * Native m_translation (Vector3) [READWRITE, PERSIST]
   * @type {Float32Array}
   */

  @type.vec3
  translation = vec3.create();

  /**
   * Local orientation of the point light relative to its attachment.
   * Native m_rotation (Quaternion) [READWRITE, PERSIST]
   * @type {Float32Array}
   */

  @type.quat
  rotation = quat.create();

  /**
   * Multiplier for the inner light radius.
   * Native m_innerScaleMultiplier (float) [READWRITE, PERSIST]
   * @type {number}
   */

  @type.float32
  innerScaleMultiplier = 1;

  /**
   * Multiplier for the outer light radius.
   * Native m_outerScaleMultiplier (float) [READWRITE, PERSIST]
   * @type {number}
   */

  @type.float32
  outerScaleMultiplier = 2;

  /**
   * Amplitude of light intensity noise.
   * Native m_noiseAmplitude (float) [READWRITE, PERSIST]
   * @type {number}
   */

  @type.float32
  noiseAmplitude = 0;

  /**
   * Frequency of light intensity noise.
   * Native m_noiseFrequency (float) [READWRITE, PERSIST]
   * @type {number}
   */

  @type.float32
  noiseFrequency = 1;

  /**
   * Number of octaves used for light intensity noise.
   * Native m_noiseOctaves (int32_t) [READWRITE, PERSIST]
   * @type {number}
   */

  @type.int32
  noiseOctaves = 1;

  /**
   * Profile path passed to the downstream light consumer; this record acquires no resource.
   * Native m_lightProfilePath (std::wstring) [READWRITE, PERSIST]
   * @type {string}
   */

  @type.wpath("Tr2LightProfileRes")
  lightProfilePath = "";

}

// Native IRoot record: concrete query identity with no exposure chain.
