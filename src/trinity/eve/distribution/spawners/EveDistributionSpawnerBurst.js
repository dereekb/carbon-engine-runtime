import { exposure as be } from "#be";
// Source: trinity/trinity/Eve/SpaceObject/Utils/EveDistributionMethods/DistributionSpawners/EveDistributionSpawnerBurst.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type } from "#schema";
import { IEveDistributionSpawner } from "./IEveDistributionSpawner.js";

/** Spawns a configured fraction of the free distribution placements in one delayed burst. */
@be.define({
  name: "EveDistributionSpawnerBurst",
  // EveDistributionSpawnerBurst_Blue.cpp:12-18, in Carbon's order.
  interfaces: [ IEveDistributionSpawner ],
  members: [
    [ be.ATTR, "delayBeforeInitialBurst", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "completeness", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "additionalTriggersPerBurst", be.READWRITE | be.PERSIST ]
  ]
})
export class EveDistributionSpawnerBurst extends IEveDistributionSpawner
{

  _localTimer = 0;

  /** m_completeness (float) [READWRITE, PERSIST] */

  @type.float32
  completeness = 1;

  /** m_additionalTriggersPerBurst (uint32_t) [READWRITE, PERSIST] */

  @type.uint32
  additionalTriggersPerBurst = 0;

  /** m_delayBeforeInitialBurst (float) [READWRITE, PERSIST] */

  @type.float32
  delayBeforeInitialBurst = 0;

  /**
   * Restarts the burst timer; the placement pool is not sorted or otherwise used
   * by this spawner.
   *
   * @implemented
   */

  Reset(_placements)
  {
    this.Restart();
  }

  /**
   * Rearms the spawner by clearing the timer, allowing the one-shot burst to
   * fire again.
   *
   * @implemented
   */

  Restart()
  {
    this._localTimer = 0;
  }

  /**
   * Waits out the initial delay, then spawns a `completeness` fraction of the
   * currently free placements plus the extra per-burst triggers in one go, and
   * disarms itself until restarted.
   *
   * @adapted
   */

  UpdateSyncronous(updateContext, _params, owner)
  {
    if (this._localTimer === -1)
    {
      return;
    }

    if (this._localTimer < this.delayBeforeInitialBurst)
    {
      this._localTimer += updateContext.GetDeltaT();
      return;
    }

    const availableTriggers = owner.GetFreePlacementCount();
    let numTriggers = Math.trunc(this.completeness * availableTriggers);
    numTriggers += this.additionalTriggersPerBurst;
    owner.AddEntities(Math.min(numTriggers, availableTriggers));
    this._localTimer = -1;
  }

  /**
   * Ignores controller variables; the burst is purely time-driven.
   *
   * @implemented
   */
  SetControllerVariable(_name, _value)
  {
  }

}
