// Source: trinity/trinity/PostProcess/Effects/Tr2PPDesaturateEffect.h
import { exposure as be } from "#be";
// Promoted to hand-maintained source 2026-07-23 (Carbon-verified property shell; schema postProcess/Tr2PPDesaturateEffect.json.).
import { type } from "#schema";
import { Tr2PPEffect } from "./Tr2PPEffect.js";

/** Carries the intensity of a post-process desaturation effect. */
@be.define({
  name: "Tr2PPDesaturateEffect",
  // Tr2PPDesaturateEffect_Blue.cpp:10-16, in Carbon's order.
  interfaces: [ Tr2PPEffect ],
  members: [
    [ be.ATTR, "intensity", be.READWRITE | be.PERSIST ]
  ],
  chainTo: Tr2PPEffect
})
export class Tr2PPDesaturateEffect extends Tr2PPEffect
{

  /** m_intensity (float) [READWRITE, PERSIST] */

  @type.float32
  intensity = 1;

}
