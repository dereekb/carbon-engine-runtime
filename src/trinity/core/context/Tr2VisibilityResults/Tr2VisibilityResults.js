import { IRoot } from "../../../../blue/blueexposure/IRoot.js";
import { exposure as be } from "#be";
// Source: trinity/trinity/Tr2VisibilityResults.h
//   trinity/trinity/Tr2VisibilityResults.cpp
//   trinity/trinity/Tr2VisibilityResults_Blue.cpp


/**
 * Collects the visibility events a visibility executor emits, for the interior
 * and portal consumers to read back.
 */
@be.define({
  name: "Tr2VisibilityResults",
  // Tr2VisibilityResults_Blue.cpp:10-16, in Carbon's order.
  members: [
    [ be.METHOD, "Clear", be.WRAP ],
    [ be.METHOD, "GetNumVisibilityEvents", be.WRAP ]
  ]
})
export class Tr2VisibilityResults extends IRoot
{

  // Carbon's m_events is private transient execution state, not Blue data.
  #events = [];

  /**
   * Adds the value-like visibility event emitted by a visibility executor.
   *
   * @adapted
   */

  AddVisibilityEvent(event)
  {
    this.#events.push(event);
  }

  /**
   * Returns a detached container view of the current visibility events.
   *
   * @adapted
   */

  GetEvents()
  {
    return this.#events.slice();
  }

  /**
   * Clears the result set.
   *
   * @implemented
   */
  Clear()
  {
    this.#events.length = 0;
  }

  /**
   * Gets the number of visibility events in the result set.
   *
   * @implemented
   */
  GetNumVisibilityEvents()
  {
    return this.#events.length;
  }

}
