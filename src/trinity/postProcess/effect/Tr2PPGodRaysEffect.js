// Source: trinity/trinity/PostProcess/Effects/Tr2PPGodRaysEffect.h
import { exposure as be } from "#be";
// Promoted to hand-maintained source 2026-07-23 (Carbon-verified property shell; schema postProcess/Tr2PPGodRaysEffect.json.).
import { type } from "#schema";
import { Tr2PPEffect } from "./Tr2PPEffect.js";
import { vec4 } from "#math/vec4";

/** Carries the color, intensity, and noise texture used for post-process god rays. */
@be.define({
  name: "Tr2PPGodRaysEffect",
  // Tr2PPGodRaysEffect_Blue.cpp:10-17, in Carbon's order.
  interfaces: [ Tr2PPEffect ],
  members: [
    [ be.ATTR, "godRayColor", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "intensity", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "noiseTexturePath", be.READWRITE | be.PERSIST ]
  ],
  chainTo: Tr2PPEffect
})
export class Tr2PPGodRaysEffect extends Tr2PPEffect
{

  /** m_godRayColor (Color) [READWRITE, PERSIST] */

  @type.color
  godRayColor = vec4.fromValues(1, 1, 1, 1);

  /** m_intensity (float) [READWRITE, PERSIST] */

  @type.float32
  intensity = 0;

  /** m_noiseTexturePath (BlueSharedString) [READWRITE, PERSIST] */

  @type.path("TriTextureRes")
  noiseTexturePath = "res:/Texture/Global/noise.dds";

  /**
   * grFactors: Carbon's const, never exposed (h:26, cpp:11). The renderer
   * sets it on the god-ray effect every frame (Tr2PostProcessRenderer.cpp:1161).
   */
  grFactors = vec4.fromValues(1000, 0.2, 128, 2);

  /** Carbon Tr2PPGodRaysEffect::IsActive override. */

  IsActive()
  {
    return this.display && this.intensity > 0;
  }

}
