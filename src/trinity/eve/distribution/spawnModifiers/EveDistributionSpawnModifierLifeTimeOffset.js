import { exposure as be } from "#be";
// Source: trinity/trinity/Eve/SpaceObject/Utils/EveDistributionMethods/DistributionSpawnModifiers/EveDistributionSpawnModifierLifeTimeOffset.h
import { IInitialize } from "../../../../blue/blueexposure/IInitialize.js";
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type } from "#schema";
import { blue } from "#blue";
import { IEveDistributionSpawnModifier } from "./IEveDistributionSpawnModifier.js";
import { CjsDistributionRandom } from "../../CjsDistributionRandom.js";

/** Offsets each spawned placement's initial lifetime with random, normalized, or cascading timing. */
@be.define({
  name: "EveDistributionSpawnModifierLifeTimeOffset",
  inherit: [ IInitialize ],
  // EveDistributionSpawnModifierLifeTimeOffset_Blue.cpp:10-19, in Carbon's order.
  interfaces: [ IEveDistributionSpawnModifier, IInitialize ],
  members: [
    [ be.ATTR, "consistentRandom", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "normalizeOffsets", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "minOffset", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "maxOffset", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "cascadingLifetimeOffset", be.READWRITE | be.PERSIST ]
  ]
})
export class EveDistributionSpawnModifierLifeTimeOffset extends IEveDistributionSpawnModifier
{

  /** `m_timeSeed`: uint32_t( BeOS->GetCurrentFrameTime() ) (EveDistributionSpawnModifierLifeTimeOffset.cpp). */
  _timeSeed = blue.os.GetCurrentFrameTime() >>> 0;

  _currentCascadingOffset = 0;

  /** m_minOffset (float) [READWRITE, PERSIST] */

  @type.float32
  minOffset = 0;

  /** m_maxOffset (float) [READWRITE, PERSIST] */

  @type.float32
  maxOffset = 0;

  /** m_consistentRandom (bool) [READWRITE, PERSIST] */

  @type.boolean
  consistentRandom = false;

  /** m_cascadingLifetimeOffset (float) [READWRITE, PERSIST] */

  @type.float32
  cascadingLifetimeOffset = 0;

  /** m_normalizeOffsets (bool) [READWRITE, PERSIST] */

  @type.boolean
  normalizeOffsets = false;

  /**
   * Reseeds the random stream from the wall clock, so offsets differ between
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
   * Staggers a spawning placement's starting lifetime: with normalizeOffsets it
   * replaces the lifetime with an evenly cascading step through the min..max
   * range across the pool, otherwise it adds a random offset in that range plus
   * a per-placement cascade.
   *
   * @adapted
   */

  ProcessSpawnModifier(placement, numPlacements)
  {
    if (this.normalizeOffsets)
    {
      const range = this.maxOffset - this.minOffset;
      const perInstanceOffset = range / numPlacements;
      this._currentCascadingOffset += perInstanceOffset;
      placement.lifeTime = this.minOffset + this._currentCascadingOffset % range;
      return;
    }

    const seed = CjsDistributionRandom.getDistributionSeed(placement.uniqueID, this._timeSeed, this.consistentRandom);
    const random = CjsDistributionRandom.createMinStdRandom(seed);
    const randomOffset = this.minOffset + (this.maxOffset - this.minOffset) * random()
      + this.cascadingLifetimeOffset * placement.initialPlacementID;
    this._currentCascadingOffset += this.cascadingLifetimeOffset;
    placement.lifeTime += randomOffset;
  }

}
