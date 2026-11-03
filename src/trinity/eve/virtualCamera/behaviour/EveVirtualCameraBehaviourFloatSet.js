// Source: trinity/trinity/Eve/VirtualCamera/EveVirtualCameraBehaviour.h
// Source: trinity/trinity/Eve/VirtualCamera/EveVirtualCameraBehaviour.cpp
import { exposure as be } from "#be";
import { type } from "#schema";
import { INotify } from "#blue";
import { EveVirtualCameraBehaviourFloatBase } from "./EveVirtualCameraBehaviourFloatBase.js";


/**
 * Float behaviour that overrides whatever the earlier behaviours accumulated
 * with an authored constant.
 */
@be.define({
  name: "EveVirtualCameraBehaviourFloatSet",
  // EveVirtualCameraBehaviour_Blue.cpp:27-30, in Carbon's order.
  interfaces: [ INotify ],
  members: [
    [ be.ATTR, "value", be.READWRITE | be.PERSIST ]
  ],
  chainTo: EveVirtualCameraBehaviourFloatBase
})
export class EveVirtualCameraBehaviourFloatSet extends EveVirtualCameraBehaviourFloatBase
{
  @type.float32
  value = 0;

  /**
   * Stamps the authored behaviour name that identifies this entry in a camera
   * behaviour list.
   */
  constructor()
  {
    super();
    this.name = "Set";
  }

  /**
   * Returns the delta that replaces the incoming value with the authored one,
   * since the camera accumulates behaviour results additively.
   *
   * @implemented
   */

  Update(_camera, current)
  {
    return this.value - current;
  }
}
