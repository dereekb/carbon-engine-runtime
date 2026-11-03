import { exposure as be } from "#be";
// Source: trinity/trinity/Particle/Tr2ParticleDragForce.h
// Source: trinity/trinity/Particle/Tr2ParticleDragForce.cpp
// Source: trinity/trinity/Particle/Tr2ParticleDragForce_Blue.cpp
import { vec3 } from "#math/vec3";
import { ITr2ParticleForce } from "./ITr2ParticleForce.js";
import { type, blue } from "#schema";


/** Linear particle drag: a force proportional to velocity and opposing it. */
@be.define({
  name: "Tr2ParticleDragForce",
  // Tr2ParticleDragForce_Blue.cpp:10-14, in Carbon's order.
  interfaces: [ ITr2ParticleForce ],
  members: [
    [ be.ATTR, "drag", be.READWRITE | be.PERSIST ]
  ]
})
export class Tr2ParticleDragForce extends ITr2ParticleForce
{
  @type.float32
  drag = 0.1;

  /**
   * Carbon's drag force is proportional and opposite to velocity.
   *
   * @adapted
   */

  GetForce(_position, velocity, _dt, _mass, out)
  {
    return vec3.scale(out, velocity, -this.drag);
  }

  /**
   * Nothing to advance per frame: drag is computed from each particle's current
   * velocity.
   *
   * @adapted
   */

  Update(_dt)
  {
  }
}
