import { exposure as be } from "#be";
import { IRoot } from "../../blue/blueexposure/IRoot.js";
// Source: trinity/trinity/Curves/TriCurveSet.h
// Source: trinity/trinity/Curves/TriCurveSet.cpp
// Source: trinity/trinity/Curves/TriCurveSet_Blue.cpp
import { type, blue } from "#schema";


/**
 * Named sub-interval of a curve set's scaled timeline, giving a start and end
 * time and whether playback loops inside it.
 */
@be.define({
  name: "Tr2CurveSetRange",
  inherit: [ IRoot ],
  // TriCurveSet_Blue.cpp:13-19, in Carbon's order.
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "startTime", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "endTime", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "looped", be.READWRITE | be.PERSIST ]
  ]
})
export class Tr2CurveSetRange extends IRoot
{
  /** Authored name used by TriCurveSet.PlayTimeRange. */

  @type.string
  name = "";

  /** First scaled-time sample in seconds. */

  @type.float32
  startTime = 0;

  /** Last scaled-time sample in seconds. */

  @type.float32
  endTime = 1;

  /** Whether playback wraps within the interval. */

  @type.boolean
  looped = false;
}

// EXPOSURE_END: this plain IRoot record exposes only its concrete identity.
