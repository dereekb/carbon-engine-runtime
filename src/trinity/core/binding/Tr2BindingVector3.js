import { exposure as be } from "#be";
import { IRoot } from "../../../blue/exposure/IRoot.js";
// Source: trinity/trinity/Tr2BindingVector3.h
// Source: trinity/trinity/Tr2BindingVector3_Blue.cpp
import { type } from "#schema";
import { vec3 } from "#math/vec3";

/** A shared vector value used by bindings, including space-object position deltas. */
@be.define({
  name: "Tr2BindingVector3",
  inherit: [ IRoot ],
  // Tr2BindingVector3_Blue.cpp:10-12, in Carbon's order.
  members: [
    [ be.ATTR, "value", be.READWRITE | be.PERSIST ]
  ]
})

export class Tr2BindingVector3 extends IRoot
{

  /** m_value (Vector3) [READWRITE, PERSIST] */

  @type.vec3
  value = vec3.create();

}

// Carbon's own query table has no exposure chain.
