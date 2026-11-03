// Source: trinity/trinity/PostProcess/Effects/Tr2PPFadeEffect.h
import { exposure as be } from "#be";
// Promoted to hand-maintained source 2026-07-23 (Carbon-verified property shell; schema postProcess/Tr2PPFadeEffect.json.).
import { type } from "#schema";
import { Tr2PPEffect } from "./Tr2PPEffect.js";
import { vec4 } from "#math/vec4";

/** Carries the color and intensity of a display-gated post-process fade. */
@be.define({
  name: "Tr2PPFadeEffect",
  // Tr2PPFadeEffect_Blue.cpp:10-16, in Carbon's order.
  interfaces: [ Tr2PPEffect ],
  members: [
    [ be.ATTR, "intensity", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "color", be.READWRITE | be.PERSIST ]
  ],
  chainTo: Tr2PPEffect
})
export class Tr2PPFadeEffect extends Tr2PPEffect
{

  /** m_color (Color) [READWRITE, PERSIST] */

  @type.color
  color = vec4.create();

  /** m_intensity (float) [READWRITE, PERSIST] */

  @type.float32
  intensity = 0;

  /** Carbon Tr2PPFadeEffect::IsActive override. */

  IsActive()
  {
    return this.display && this.intensity > 0;
  }

}
