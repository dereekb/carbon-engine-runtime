import { IRoot } from "../../../blue/blueexposure/IRoot.js";
import { exposure as be } from "#be";
// Source: trinity/trinity/Eve/UI/EveEllipseDefinition.h
import { type, blue } from "#schema";
import { INotify } from "../../../blue/blueexposure/INotify.js";
//   trinity/trinity/Eve/UI/EveEllipseDefinition.cpp
import { vec3 } from "#math/vec3";



/**
 * One authored ellipse of an ellipse set - centre, plane normal, in-plane
 * rotation in degrees and the two semi-axis lengths.
 */
@be.define({
  name: "EveEllipseDefinition",
  inherit: [ INotify ],
  // EveEllipseDefinition_Blue.cpp:10-18, in Carbon's order.
  interfaces: [ INotify ],
  members: [
    [ be.ATTR, "center", be.READWRITE | be.NOTIFY | be.PERSIST ],
    [ be.ATTR, "semiMajor", be.READWRITE | be.NOTIFY | be.PERSIST ],
    [ be.ATTR, "semiMinor", be.READWRITE | be.NOTIFY | be.PERSIST ],
    [ be.ATTR, "planeNormal", be.READWRITE | be.NOTIFY | be.PERSIST ],
    [ be.ATTR, "rotationDegrees", be.READWRITE | be.NOTIFY | be.PERSIST ]
  ]
})
export class EveEllipseDefinition extends IRoot
{
  _dirtyFlag = null;


  @type.vec3
  center = vec3.create();


  @type.vec3
  planeNormal = vec3.fromValues(0, 1, 0);


  @type.float32
  rotationDegrees = 0;


  @type.float32
  semiMajor = 1;


  @type.float32
  semiMinor = 1;

  /**
   * Invokes the bound dirty callback so the owning set regenerates its geometry
   * after any authored field changes.
   */

  OnModified(_value = null)
  {
    this._dirtyFlag?.();
    return true;
  }

  /**
   * Installs the callback invoked whenever this definition is modified; pass
   * null to unbind, and anything that is neither a function nor null throws.
   */

  SetDirtyFlag(dirtyFlag)
  {
    if (dirtyFlag !== null && typeof dirtyFlag !== "function")
    {
      throw new TypeError("EveEllipseDefinition dirty flag must be a function or null");
    }
    this._dirtyFlag = dirtyFlag;
  }
}

// Exact native Blue exposure: only these identities participate in loading.
