import { exposure as be } from "#be";
import { IRoot } from "../../../blue/exposure/IRoot.js";
// Source: trinity/trinity/TriFloat.h
// Source: trinity/trinity/TriFloat.cpp
// Source: trinity/trinity/TriFloat_Blue.cpp
import { type } from "#schema";

/**
 * Separate scalar storage that breaks stretch-to-binding reference cycles.
 * Native TriFloat.h keeps a stretch length outside its owning stretch so a
 * curve-set binding can hold the scalar without retaining the stretch.
 */
@be.define({
  name: "TriFloat",
  inherit: [ IRoot ],
  // TriFloat_Blue.cpp:10-13, in Carbon's order.
  members: [
    [ be.ATTR, "value", be.READWRITE | be.PERSIST ]
  ]
})

export class TriFloat extends IRoot
{

  /** m_value (float) [READWRITE, PERSIST] */

  @type.float32
  value = 0;

}

// Native IRoot record: concrete query identity with no exposure chain.
