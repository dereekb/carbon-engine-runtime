import { exposure as be } from "#be";
import { IRoot } from "../../blue/blueexposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type, blue } from "#schema";

/** Stores a named integer counter used to deplete layout-distribution capacity deterministically. */
@be.define({
  name: "EveSOFDataDistributionDepletionCounter",
  inherit: [ IRoot ],
  // EveSOFData_Blue2.cpp:324-327, in Carbon's order.
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "value", be.READWRITE | be.PERSIST ]
  ]
})
export class EveSOFDataDistributionDepletionCounter extends IRoot
{

  /** m_value (int32_t) [READWRITE, PERSIST] */

  @type.int32
  value = 1;

  /** m_name (std::string) [READWRITE, PERSIST] */

  @type.string
  name = "";

}
