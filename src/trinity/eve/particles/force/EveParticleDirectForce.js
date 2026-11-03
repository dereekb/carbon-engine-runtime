// Source: trinity/trinity/Eve/EveParticleDirectForce.h
// Source: trinity/trinity/Eve/EveParticleDirectForce_Blue.cpp
import { exposure as be } from "#be";
import { Tr2ParticleDirectForce } from "../../../particle/force/Tr2ParticleDirectForce.js";


/**
 * Blue alias of Tr2ParticleDirectForce - Carbon registers the Eve name with
 * zero attributes of its own and chains the whole exposure to the Tr2 class.
 */
@be.define({
  name: "EveParticleDirectForce",
  // EveParticleDirectForce_Blue.cpp:10-12, in Carbon's order.
  members: [],
  chainTo: Tr2ParticleDirectForce
})
export class EveParticleDirectForce extends Tr2ParticleDirectForce
{
}
