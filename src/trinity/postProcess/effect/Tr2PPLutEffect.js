import { exposure as be } from "#be";
// Source: trinity/trinity/PostProcess/Effects/Tr2PPLutEffect.h
// Promoted to hand-maintained source 2026-07-23 (Carbon-verified property shell; schema postProcess/Tr2PPLutEffect.json.).
import { type, blue } from "#schema";
import { Tr2PPEffect } from "./Tr2PPEffect.js";

/** Carries a color lookup texture and influence for post-process grading. */
@be.define({
  name: "Tr2PPLutEffect",
  // Tr2PPLutEffect_Blue.cpp:10-16, in Carbon's order.
  interfaces: [ Tr2PPEffect ],
  members: [
    [ be.ATTR, "influence", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "path", be.READWRITE | be.PERSIST ]
  ],
  chainTo: Tr2PPEffect
})
export class Tr2PPLutEffect extends Tr2PPEffect
{

  /** m_influence (float) [READWRITE, PERSIST] */

  @type.float32
  influence = 0;

  /** m_path (BlueSharedString) [READWRITE, PERSIST] */

  @type.path("TriTextureRes")
  path = "res:/dx9/scene/postprocess/LUTdefault.dds";

  /** Carbon Tr2PPLutEffect::IsActive override. */

  IsActive()
  {
    return this.display && this.influence > 0;
  }

}
