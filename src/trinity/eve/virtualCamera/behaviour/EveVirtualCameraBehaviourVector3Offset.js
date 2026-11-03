import { exposure as be } from "#be";
// Source: trinity/trinity/Eve/VirtualCamera/EveVirtualCameraBehaviour.h
// Source: trinity/trinity/Eve/VirtualCamera/EveVirtualCameraBehaviour.cpp
import { vec3 } from "#math/vec3";
import { type, blue } from "#schema";
import { INotify } from "#blue";
import { EveVirtualCameraBehaviourVector3Base } from "./EveVirtualCameraBehaviourVector3Base.js";


/**
 * Vector3 behaviour that applies a fixed, time-independent displacement, either
 * in world space or in the anchor's yaw frame.
 */
@be.define({
  name: "EveVirtualCameraBehaviourVector3Offset",
  // EveVirtualCameraBehaviour_Blue.cpp:114-119, in Carbon's order.
  interfaces: [ INotify ],
  members: [
    [ be.ATTR, "offset", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "proportional", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "world", be.READWRITE | be.PERSIST ]
  ],
  chainTo: EveVirtualCameraBehaviourVector3Base
})
export class EveVirtualCameraBehaviourVector3Offset extends EveVirtualCameraBehaviourVector3Base
{
  @type.boolean
  proportional = true;

  @type.boolean
  world = false;

  @type.vec3
  offset = vec3.create();

  /**
   * Names the behaviour "Offset"; it owns no curves, so the offset is constant
   * over the timeline.
   */
  constructor()
  {
    super();
    this.name = "Offset";
  }

  /**
   * Returns the authored offset, yawed into the anchor's heading unless world is
   * set and multiplied by the anchor radius when proportional is set; it ignores
   * time and delta time entirely.
   *
   * @adapted
   */

  Update(_camera, _current, _deltaTime, _localElapsedTime, _anchorPosition, anchorRadius, anchorForwardDirection, out)
  {
    if (this.world)
    {
      vec3.copy(out, this.offset);
    }
    else
    {
      EveVirtualCameraBehaviourVector3Base.rotateVectorWithAnchor(out, this.offset, anchorForwardDirection);
    }
    if (this.proportional)
    {
      vec3.scale(out, out, anchorRadius);
    }
    return out;
  }
}
