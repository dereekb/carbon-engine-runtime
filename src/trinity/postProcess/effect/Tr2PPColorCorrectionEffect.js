// Source: trinity/trinity/PostProcess/Effects/Tr2PPColorCorrectionEffect.h
import { exposure as be } from "#be";
// Promoted to hand-maintained source 2026-07-23 (Carbon-verified property shell; schema postProcess/Tr2PPColorCorrectionEffect.json.).
import { type } from "#schema";
import { Tr2PPEffect } from "./Tr2PPEffect.js";
import { vec3 } from "#math/vec3";

/** Carries white-balance, saturation, contrast, gamma, gain, and offset settings for post-process color correction. */
@be.define({
  name: "Tr2PPColorCorrectionEffect",
  // Tr2PPColorCorrectionEffect_Blue.cpp:10-21, in Carbon's order.
  interfaces: [ Tr2PPEffect ],
  members: [
    [ be.ATTR, "whiteTemperature", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "whiteTint", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "colorSaturation", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "colorContrast", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "colorGamma", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "colorGain", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "colorOffset", be.READWRITE | be.PERSIST ]
  ],
  chainTo: Tr2PPEffect
})
export class Tr2PPColorCorrectionEffect extends Tr2PPEffect
{

  /** m_whiteTint (float) [READWRITE, PERSIST] */

  @type.float32
  whiteTint = 0;

  /** m_colorSaturation (float) [READWRITE, PERSIST] */

  @type.float32
  colorSaturation = 1;

  /** m_colorContrast (float) [READWRITE, PERSIST] */

  @type.float32
  colorContrast = 1;

  /** m_colorGamma (float) [READWRITE, PERSIST] */

  @type.float32
  colorGamma = 1;

  /** m_colorGain (Vector3) [READWRITE, PERSIST] */

  @type.vec3
  colorGain = vec3.fromValues(1, 1, 1);

  /** m_colorOffset (Vector3) [READWRITE, PERSIST] */

  @type.vec3
  colorOffset = vec3.create();

  /** m_whiteTemperature (float) [READWRITE, PERSIST] */

  @type.float32
  whiteTemperature = 6500;

}
