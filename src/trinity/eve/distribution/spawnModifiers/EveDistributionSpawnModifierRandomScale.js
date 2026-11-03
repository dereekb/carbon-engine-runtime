// Source: trinity/trinity/Eve/SpaceObject/Utils/EveDistributionMethods/DistributionSpawnModifiers/EveDistributionSpawnModifierRandomScale.h
import { exposure as be } from "#be";
import { IInitialize } from "../../../../blue/exposure/IInitialize.js";
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type } from "#schema";
import { blue } from "#blue";
import { IEveDistributionSpawnModifier } from "./IEveDistributionSpawnModifier.js";
import { vec3 } from "#math/vec3";
import { CjsDistributionRandom } from "../../CjsDistributionRandom.js";

/** Applies or replaces each spawned placement's scale with seeded random per-axis or uniform values. */
@be.define({
  name: "EveDistributionSpawnModifierRandomScale",
  inherit: [ IInitialize ],
  // EveDistributionSpawnModifierRandomScale_Blue.cpp:12-21, in Carbon's order.
  interfaces: [ IEveDistributionSpawnModifier, IInitialize ],
  members: [
    [ be.ATTR, "overrideScale", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "consistentRandom", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "uniformScale", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "minScale", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "maxScale", be.READWRITE | be.PERSIST ]
  ]
})
export class EveDistributionSpawnModifierRandomScale extends IEveDistributionSpawnModifier
{

  /** `m_timeSeed`: uint32_t( BeOS->GetCurrentFrameTime() ) (EveDistributionSpawnModifierRandomScale.cpp). */
  _timeSeed = blue.os.GetCurrentFrameTime() >>> 0;

  /** m_minScale (Vector3) [READWRITE, PERSIST] */

  @type.vec3
  minScale = vec3.fromValues(1, 1, 1);

  /** m_maxScale (Vector3) [READWRITE, PERSIST] */

  @type.vec3
  maxScale = vec3.fromValues(1, 1, 1);

  /** m_consistentRandom (bool) [READWRITE, PERSIST] */

  @type.boolean
  consistentRandom = false;

  /** m_uniformScale (bool) [READWRITE, PERSIST] */

  @type.boolean
  uniformScale = false;

  /** m_overrideScale (bool) [READWRITE, PERSIST] */

  @type.boolean
  overrideScale = false;

  /**
   * Reseeds the random stream from the wall clock, so scales differ between runs
   * unless consistentRandom pins them to the placement id.
   *
   * @adapted
   */

  Initialize()
  {
    this._timeSeed = blue.os.GetCurrentFrameTime() >>> 0;
    return true;
  }

  /**
   * Draws a random scale between minScale and maxScale - per axis, or with one
   * shared factor when uniformScale is set - and either replaces the placement's
   * initial scale or multiplies into it.
   *
   * @adapted
   */

  ProcessSpawnModifier(placement, _numPlacements)
  {
    const seed = CjsDistributionRandom.getDistributionSeed(placement.uniqueID, this._timeSeed, this.consistentRandom);
    const random = CjsDistributionRandom.createMinStdRandom(seed);
    const scale = vec3.create();

    if (this.uniformScale)
    {
      vec3.lerp(scale, this.minScale, this.maxScale, random());
    }
    else
    {
      for (let axis = 0; axis < 3; axis++)
      {
        scale[axis] = this.minScale[axis] + (this.maxScale[axis] - this.minScale[axis]) * random();
      }
    }

    if (this.overrideScale)
    {
      placement.initialScale.set(scale);
    }
    else
    {
      vec3.multiply(placement.initialScale, placement.initialScale, scale);
    }
  }

}
