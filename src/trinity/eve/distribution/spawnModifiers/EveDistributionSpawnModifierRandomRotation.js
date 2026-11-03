// Source: trinity/trinity/Eve/SpaceObject/Utils/EveDistributionMethods/DistributionSpawnModifiers/EveDistributionSpawnModifierRandomRotation.h
import { exposure as be } from "#be";
import { IInitialize } from "../../../../blue/exposure/IInitialize.js";
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type } from "#schema";
import { blue } from "#blue";
import { IEveDistributionSpawnModifier } from "./IEveDistributionSpawnModifier.js";
import { quat } from "#math/quat";
import { vec3 } from "#math/vec3";
import { CjsDistributionRandom } from "../../CjsDistributionRandom.js";

/** Applies or replaces each spawned placement's orientation with a seeded random yaw, pitch, and roll. */
@be.define({
  name: "EveDistributionSpawnModifierRandomRotation",
  inherit: [ IInitialize ],
  // EveDistributionSpawnModifierRandomRotation_Blue.cpp:10-18, in Carbon's order.
  interfaces: [ IEveDistributionSpawnModifier, IInitialize ],
  members: [
    [ be.ATTR, "overrideRotation", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "consistentRandom", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "minRotation", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "maxRotation", be.READWRITE | be.PERSIST ]
  ]
})
export class EveDistributionSpawnModifierRandomRotation extends IEveDistributionSpawnModifier
{

  /** `m_timeSeed`: uint32_t( BeOS->GetCurrentFrameTime() ) (EveDistributionSpawnModifierRandomRotation.cpp). */
  _timeSeed = blue.os.GetCurrentFrameTime() >>> 0;

  /** m_minRotation (Vector3) [READWRITE, PERSIST] */

  @type.vec3
  minRotation = vec3.create();

  /** m_maxRotation (Vector3) [READWRITE, PERSIST] */

  @type.vec3
  maxRotation = vec3.create();

  /** m_consistentRandom (bool) [READWRITE, PERSIST] */

  @type.boolean
  consistentRandom = false;

  /** m_overrideRotation (bool) [READWRITE, PERSIST] */

  @type.boolean
  overrideRotation = false;

  /**
   * Reseeds the random stream from the wall clock, so rotations differ between
   * runs unless consistentRandom pins them to the placement id.
   *
   * @adapted
   */

  Initialize()
  {
    this._timeSeed = blue.os.GetCurrentFrameTime() >>> 0;
    return true;
  }

  /**
   * Builds a rotation from random yaw, pitch and roll between minRotation and
   * maxRotation, then either replaces the placement's initial rotation or
   * combines it with the authored one.
   *
   * @adapted
   */

  ProcessSpawnModifier(placement, _numPlacements)
  {
    const seed = CjsDistributionRandom.getDistributionSeed(placement.uniqueID, this._timeSeed, this.consistentRandom);
    const random = CjsDistributionRandom.createMinStdRandom(seed);
    const euler = vec3.create();
    for (let axis = 0; axis < 3; axis++)
    {
      euler[axis] = this.minRotation[axis] + (this.maxRotation[axis] - this.minRotation[axis]) * random();
    }

    const rotation = CjsDistributionRandom.setYawPitchRoll(quat.create(), euler[0], euler[1], euler[2]);
    if (this.overrideRotation)
    {
      placement.initialRotation.set(rotation);
    }
    else
    {
      // Carbon (row-vector): rotation * initialRotation - the random rotation
      // applies first.
      quat.multiply(placement.initialRotation, placement.initialRotation, rotation);
    }
  }

}
