import { exposure as be } from "#be";
// Source: trinity/trinity/PostProcess/Effects/Tr2PPFilmGrainEffect.h
// Promoted to hand-maintained source 2026-07-23 (Carbon-verified property shell; schema postProcess/Tr2PPFilmGrainEffect.json.).
import { type, blue } from "#schema";
import { Tr2PPEffect } from "./Tr2PPEffect.js";

/** Carries the density, size, contrast, color, brightness, and intensity settings for post-process film grain. */
@be.define({
  name: "Tr2PPFilmGrainEffect",
  // Tr2PPFilmGrainEffect_Blue.cpp:10-22, in Carbon's order.
  interfaces: [ Tr2PPEffect ],
  members: [
    [ be.ATTR, "colored", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "colorAmount", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "grainSize", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "intensity", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "grainDensity", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "grainContrast", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "brightnessModifier", be.READWRITE | be.PERSIST ]
  ],
  chainTo: Tr2PPEffect
})
export class Tr2PPFilmGrainEffect extends Tr2PPEffect
{

  /** m_colorAmount (float) [READWRITE, PERSIST] */

  @type.float32
  colorAmount = 0.6;

  /** m_grainContrast (float) [READWRITE, PERSIST] */

  @type.float32
  grainContrast = 4;

  /** m_grainDensity (float) [READWRITE, PERSIST] */

  @type.float32
  grainDensity = 0.35;

  /** m_intensity (float) [READWRITE, PERSIST] */

  @type.float32
  intensity = 0.0008;

  /** m_grainSize (float) [READWRITE, PERSIST] */

  @type.float32
  grainSize = 1.25;

  /** m_brightnessModifier (float) [READWRITE, PERSIST] */

  @type.float32
  brightnessModifier = -3;

  /** m_colored (bool) [READWRITE, PERSIST] */

  @type.boolean
  colored = true;

  /** Carbon Tr2PPFilmGrainEffect::IsActive override. */

  IsActive()
  {
    return this.display && this.intensity > 0;
  }

}
