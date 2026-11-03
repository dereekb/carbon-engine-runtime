import { IRoot } from "../../../../blue/exposure/IRoot.js";
import { exposure as be } from "#be";
// Source: trinity/trinity/Eve/VirtualCamera/EveVirtualCameraBehaviour.h
// Source: trinity/trinity/Eve/VirtualCamera/EveVirtualCameraBehaviour.cpp
import { IsMatch } from "#blue";
import { INotify } from "../../../../blue/exposure/INotify.js";
import { type } from "#schema";


/**
 * Base for the virtual camera behaviours that contribute a scalar delta to a
 * camera's field of view or roll each update.
 *
 * @abstract
 */
@be.define({
  name: "EveVirtualCameraBehaviourFloatBase",
  inherit: [ INotify ],
  // EveVirtualCameraBehaviour_Blue.cpp:13-16, in Carbon's order.
  interfaces: [ INotify ],
  members: [
    [ be.ATTR, "name", be.READWRITE | be.NOTIFY | be.PERSIST ],
    [ be.ATTR, "active", be.READWRITE | be.PERSIST ]
  ]
})
@be.abstract
export class EveVirtualCameraBehaviourFloatBase extends IRoot
{
  @type.boolean
  active = true;


  @type.string
  name = "";

  /**
   * Returns the authored behaviour name shown in tooling.
   *
   * @implemented
   */

  GetName()
  {
    return this.name;
  }

  /**
   * Sets the behaviour name, coercing to a string; subclasses override this to
   * rename the curves they own alongside it.
   *
   * @implemented
   */

  SetName(name)
  {
    this.name = String(name);
  }

  /**
   * Re-applies the current name after a field change, which propagates it to any
   * owned curves through the subclass SetName override.
   *
   * @implemented
   */

  OnModified(propertyName)
  {
    if (IsMatch(propertyName, "name")) this.SetName(this.name);
    return true;
  }

  /**
   * Reports whether the camera should evaluate this behaviour this update.
   *
   * @implemented
   */

  IsActive()
  {
    return this.active;
  }
}

// Exact native Blue exposure: only these identities participate in loading.
