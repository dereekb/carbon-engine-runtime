// Source: trinity/trinity/PostProcess/Effects/Tr2PPTaaEffect.h
// Source: trinity/trinity/PostProcess/Effects/Tr2PPTaaEffect.cpp
import { exposure as be } from "#be";
import { type } from "#schema";
import { Tr2PPEffect } from "./Tr2PPEffect.js";
import { Debug } from "../../generated/postProcess/enums.js";
import { blue, EnumRegistrationType } from "#blue";


/**
 * Temporal anti-aliasing settings: quality level, the early-out threshold below
 * which pixels are left alone, and the debug visualization selector.
 */
@be.define({
  name: "Tr2PPTaaEffect",
  // Tr2PPTaaEffect_Blue.cpp:27-35, in Carbon's order.
  interfaces: [ Tr2PPEffect ],
  members: [
    [ be.ATTR_CHOOSER, "quality", be.READWRITE | be.ENUM, "trinity.Tr2PPTaaEffect.Quality" ],
    [ be.ATTR_CHOOSER, "debug", be.READWRITE | be.ENUM, "trinity.Tr2PPTaaEffect.Debug" ],
    [ be.ATTR, "earlyOutThreshold", be.READWRITE ]
  ],
  chainTo: Tr2PPEffect
})
export class Tr2PPTaaEffect extends Tr2PPEffect
{

  /** Carbon: MAP_ATTRIBUTE_WITH_CHOOSER (trinity/trinity/PostProcess/Effects/Tr2PPTaaEffect_Blue.cpp:31); chooser Tr2PPTaaEffectDebugChooser (trinity/trinity/PostProcess/Effects/Tr2PPTaaEffect_Blue.cpp:17). */
  @type.int32
  @type.enum("trinity.Tr2PPTaaEffect.Debug")
  debug = Tr2PPTaaEffect.TAA_DEBUG_OFF;

  /** Carbon: MAP_ATTRIBUTE_WITH_CHOOSER (trinity/trinity/PostProcess/Effects/Tr2PPTaaEffect_Blue.cpp:30); chooser Tr2PPTaaEffectQualityChooser (trinity/trinity/PostProcess/Effects/Tr2PPTaaEffect_Blue.cpp:9). */
  @type.int32
  @type.enum("trinity.Tr2PPTaaEffect.Quality")
  quality = Tr2PPTaaEffect.TAA_HIGH;

  @type.float32
  earlyOutThreshold = 0.001;

  /**
   * Reports TAA as contributing whenever it is displayed; unlike the other
   * effects it has no intensity or scale to gate on.
   */

  IsActive()
  {
    return this.display !== false;
  }

  static Quality = { TAA_LOW: 1, TAA_MEDIUM: 2, TAA_HIGH: 3 };

  static Debug = Debug;

  static TAA_LOW = 1;

  static TAA_MEDIUM = 2;

  static TAA_HIGH = 3;

  static TAA_DEBUG_OFF = 0;

  static TAA_DEBUG_MOTION_VECTORS = 1;

  static TAA_DEBUG_EARLY_OUT_MASK = 2;

}

blue.enums.Create("trinity.Tr2PPTaaEffect.Quality", Tr2PPTaaEffect.Quality, {
  exposedName: "TaaQuality", exposure: EnumRegistrationType.ENUM_REG_ENUM_OBJECT_ON_MODULE,
  chooser: [
    { name: "Low", value: Tr2PPTaaEffect.Quality.TAA_LOW, description: "Low Quality" },
    { name: "Medium", value: Tr2PPTaaEffect.Quality.TAA_MEDIUM, description: "Medium Quality" },
    { name: "High", value: Tr2PPTaaEffect.Quality.TAA_HIGH, description: "High Quality" }
  ]
});
