import { exposure as be } from "#be";
// Source: trinity/trinity/PostProcess/Effects/Tr2PPSignalLossEffect.h
// Promoted to hand-maintained source 2026-07-23 (Carbon-verified property shell; schema postProcess/Tr2PPSignalLossEffect.json.).
import { type, blue } from "#schema";
import { Tr2PPEffect } from "./Tr2PPEffect.js";

/** Carries the strength of a display-gated post-process signal-loss effect. */
@be.define({
  name: "Tr2PPSignalLossEffect",
  // Tr2PPSignalLossEffect_Blue.cpp:10-15, in Carbon's order.
  interfaces: [ Tr2PPEffect ],
  members: [
    [ be.ATTR, "strength", be.READWRITE | be.PERSIST ]
  ],
  chainTo: Tr2PPEffect
})
export class Tr2PPSignalLossEffect extends Tr2PPEffect
{

  /** m_strength (float) [READWRITE, PERSIST] */

  @type.float32
  strength = 0;

  /** Carbon Tr2PPSignalLossEffect::IsActive override. */

  IsActive()
  {
    return this.display && this.strength > 0;
  }

}
