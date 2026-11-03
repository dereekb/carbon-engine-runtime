import { exposure as be } from "#be";
// Source: trinity/trinity/PostProcess/Effects/Tr2PPDynamicExposureEffect.h
// Promoted to hand-maintained source 2026-07-23 (Carbon-verified property shell; schema postProcess/Tr2PPDynamicExposureEffect.json.).
import { type, blue } from "#schema";
import { Tr2PPEffect } from "./Tr2PPEffect.js";

/** Carries the luminance range, adaptation speeds, brightness limits, and influence used for dynamic exposure. */
@be.define({
  name: "Tr2PPDynamicExposureEffect",
  // Tr2PPDynamicExposureEffect_Blue.cpp:10-26, in Carbon's order.
  interfaces: [ Tr2PPEffect ],
  members: [
    [ be.ATTR, "minBrightness", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "maxBrightness", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "increaseSpeed", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "decreaseSpeed", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "minLuminance", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "maxLuminance", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "influence", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "middleValue", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "adjustment", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "minExposure", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "maxExposure", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "debug", be.READWRITE ]
  ],
  chainTo: Tr2PPEffect
})
export class Tr2PPDynamicExposureEffect extends Tr2PPEffect
{

  /** m_debug (bool) [READWRITE] */
  @type.boolean
  debug = false;

  /** m_adjustment (float) [READWRITE, PERSIST] */

  @type.float32
  adjustment = 0;

  /** m_influence (float) [READWRITE, PERSIST] */

  @type.float32
  influence = 1;

  /** m_minBrightness (float) [READWRITE, PERSIST] */

  @type.float32
  minBrightness = 0.9;

  /** m_maxLuminance (float) [READWRITE, PERSIST] */

  @type.float32
  maxLuminance = 10;

  /** m_maxExposure (float) [READWRITE, PERSIST] */

  @type.float32
  maxExposure = 10;

  /** m_middleValue (float) [READWRITE, PERSIST] */

  @type.float32
  middleValue = 0.55;

  /** m_minLuminance (float) [READWRITE, PERSIST] */

  @type.float32
  minLuminance = 0.4649;

  /** m_minExposure (float) [READWRITE, PERSIST] */

  @type.float32
  minExposure = -3.7;

  /** m_decreaseSpeed (float) [READWRITE, PERSIST] */

  @type.float32
  decreaseSpeed = 1.5;

  /** m_increaseSpeed (float) [READWRITE, PERSIST] */

  @type.float32
  increaseSpeed = 2;

  /** m_maxBrightness (float) [READWRITE, PERSIST] */

  @type.float32
  maxBrightness = 0.98;

}
