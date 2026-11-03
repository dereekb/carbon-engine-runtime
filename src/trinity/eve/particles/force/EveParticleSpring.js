// Source: trinity/trinity/Eve/EveParticleSpringAttractor.h
// Source: trinity/trinity/Eve/EveParticleSpringAttractor_Blue.cpp
import { exposure as be } from "#be";
import { Tr2ParticleSpring } from "../../../particle/force/Tr2ParticleSpring.js";


/**
 * Blue alias of Tr2ParticleSpring - Carbon registers the Eve name (from the
 * ...SpringAttractor source files) with zero attributes of its own and chains
 * the whole exposure to the Tr2 class.
 */
@be.define({
  name: "EveParticleSpring",
  // EveParticleSpringAttractor_Blue.cpp:10-12, in Carbon's order.
  members: [],
  chainTo: Tr2ParticleSpring
})
export class EveParticleSpring extends Tr2ParticleSpring
{
}
