import { exposure as be } from "#be";
import { IRoot } from "../../blue/blueexposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue2.cpp:409-416
import { type, blue } from "#schema";

/**
 * Provides the persisted wrapper used for a generic SOF string value.
 * Native IRoot-only data with a self-only Blue table. Constructor/destructor
 * are empty; no initialization, update or resource lifecycle is required.
 */
@be.define({
  name: "EveSOFDataGenericString",
  inherit: [ IRoot ],
  // EveSOFData_Blue2.cpp:411-414, in Carbon's order.
  members: [
    [ be.ATTR, "str", be.READWRITE | be.PERSIST ]
  ]
})

export class EveSOFDataGenericString extends IRoot
{

  /** m_str (std::string) [READWRITE, PERSIST] */

  @type.string
  str = "";

}

