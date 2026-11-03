import { exposure as be } from "#be";
import { IRoot } from "../../../../blue/exposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObject/Utils/fxAttributes/IEveFxAttribute.h


/** Required EVE effect-attribute update contract. */
@be.interface("IEveFxAttribute")
@be.inherit(IRoot)
export class IEveFxAttribute extends IRoot
{

  /**
   * Updates effect attributes during the asynchronous graph phase.
   *
   * @abstract
   */
  @be.abstract
  UpdateAsyncronous(_updateContext) {}

}
