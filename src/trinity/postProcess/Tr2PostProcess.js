import { IRoot } from "../../blue/exposure/IRoot.js";
import { exposure as be } from "#be";
import { IInitialize } from "../../blue/exposure/IInitialize.js";
// Source: trinity/trinity/Tr2PostProcess.h
// Source: trinity/trinity/Tr2PostProcess.cpp
import { type } from "#schema";
import { BlueList } from "#blue";
import { Tr2Effect } from "../shader/Tr2Effect.js";


/**
 * Post-process described as a flat ordered list of Tr2Effect stages, in contrast
 * to Tr2PostProcess2's named effect slots.
 */
@be.define({
  name: "Tr2PostProcess",
  inherit: [ IInitialize ],
  // Tr2PostProcess_Blue.cpp:10-14, in Carbon's order.
  members: [
    [ be.ATTR, "stages", be.READ | be.PERSIST ]
  ]
})
export class Tr2PostProcess extends IRoot
{
  @type.list("Tr2Effect")
  stages = new BlueList(Tr2Effect, { className: "Tr2Effect" });

  /**
   * Accepts the authored stage graph; Carbon performs no additional setup.
   *
   * @implemented
   */

  Initialize()
  {
    return true;
  }

}
