import { exposure as be } from "#be";
import { IRoot } from "../../blue/blueexposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h

/** Empty native IRoot blink settings record; self exposure is in EveSOFData_Blue2.cpp:137-142. */
@be.define({
  name: "EveSOFDataBlink",
  inherit: [ IRoot ],
  // EveSOFData_Blue2.cpp:139-140, in Carbon's order.
  members: []
})

export class EveSOFDataBlink extends IRoot
{

  /** Reports the empty settings shape; this convenience has no native method.
   * @returns {boolean} Always true.
   */
  IsEmpty()
  {
    return true;
  }

}

