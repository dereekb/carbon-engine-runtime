import { exposure as be } from "#be";
import { IRoot } from "../../blue/exposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObject/Utils/EveThrottleable.h
// Source: trinity/trinity/Eve/SpaceObject/Utils/EveThrottleable.cpp
import { type } from "#schema";
import { blue, CcpTime } from "#blue";


/**
 * Update-rate state for objects that run at less than frame rate, mapping a
 * normalized detail level onto an update frequency between authored bounds.
 */
@be.define({
  name: "EveThrottleable",
  inherit: [ IRoot ],
  // EveThrottleable_Blue.cpp:10-16, in Carbon's order.
  members: [
    [ be.ATTR, "updateThrottle", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "minUpdateFrequency", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "maxUpdateFrequency", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "currentUpdateFrequency", be.READ ]
  ]
})

export class EveThrottleable extends IRoot
{
  @type.float32
  currentUpdateFrequency = 10;

  @type.boolean
  updateThrottle = true;

  @type.uint32
  maxUpdateFrequency = 20;

  @type.uint32
  minUpdateFrequency = 2;

  /** m_nextUpdateTS (Be::Time, Blue 100ns ticks): the actual time before which updates are skipped. */
  _nextUpdateTS = 0;

  /**
   * Carbon ShouldSkipUpdate (EveThrottleable.cpp:16-35): whether this object
   * should skip the current update, judged against Blue's actual time read
   * here, as Carbon reads `BeOS->GetActualTime()`. An update that is allowed
   * also picks the next update time from the detail level, so callers must
   * not call this more than once per intended update.
   *
   * @implemented
   * @param {number} [normalizedUpdateFrequency=0.5] 0..1 detail level between the min and max frequency.
   * @returns {boolean} True to skip this update.
   */

  ShouldSkipUpdate(normalizedUpdateFrequency = 0.5)
  {
    const currentTime = blue.os.GetActualTime();

    if (!this.updateThrottle)
    {
      return false;
    }

    // Skip updates based on the current distance-related update frequency.
    if (currentTime < this._nextUpdateTS)
    {
      return true;
    }

    // Carbon quirk (CE-193), reproduced: the bounds are uint32_t
    // (EveThrottleable.h:18-19) and are subtracted before the float cast, so a
    // max below the min wraps (EveThrottleable.cpp:31); `>>> 0` keeps that.
    // The sum is float arithmetic, and its 0.1f floor is a comparison (cpp:31-32),
    // so each step narrows with Math.fround.
    const range = Math.fround((this.maxUpdateFrequency - this.minUpdateFrequency) >>> 0);
    const updateFrequency = Math.fround(Math.fround(Math.fround(normalizedUpdateFrequency) * range) + Math.fround(this.minUpdateFrequency));
    // Floor: update every 10 seconds at the least (cpp:32).
    this.currentUpdateFrequency = Math.max(updateFrequency, Math.fround(0.1));
    this._nextUpdateTS = currentTime + CcpTime.timeFromDouble(1 / this.currentUpdateFrequency);
    return false;
  }
}
