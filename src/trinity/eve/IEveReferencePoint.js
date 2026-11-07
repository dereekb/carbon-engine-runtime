import { exposure as be } from "#be";
import { IRoot } from "../../blue/exposure/IRoot.js";
// Source: trinity/trinity/Include/IEveReferencePoint.h


/** Required time-varying world reference-point contract. */
@be.interface("IEveReferencePoint")
@be.inherit(IRoot)

export class IEveReferencePoint extends IRoot
{

  /**
   * Writes the world reference point for the requested time.
   *
   * @abstract
   */
  @be.abstract
  GetReferencePoint(_time, _out)
  {
  }

}
