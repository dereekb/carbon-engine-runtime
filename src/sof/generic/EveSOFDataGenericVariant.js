import { exposure as be } from "#be";
import { IRoot } from "../../blue/blueexposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue2.cpp:546-555
import { type, blue } from "#schema";

/** Names a generic variant and its optional hull-area override and transparency policy.
 * Native IRoot-only data with a self-only Blue table. Field initializers
 * preserve native defaults; no initialization, update or resource lifecycle
 * is required, and the native destructor is empty.
 * The hull area is an authored object reference, not a held resource.
 */
@be.define({
  name: "EveSOFDataGenericVariant",
  inherit: [ IRoot ],
  // EveSOFData_Blue2.cpp:548-553, in Carbon's order.
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "isTransparent", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "hullArea", be.READWRITE | be.PERSIST ]
  ]
})

export class EveSOFDataGenericVariant extends IRoot
{

  /** m_name (BlueSharedString) [READWRITE, PERSIST] */

  @type.string
  name = "";

  /** m_isTransparent (bool) [READWRITE, PERSIST] */

  @type.boolean
  isTransparent = false;

  /** m_hullArea (EveSOFDataHullAreaPtr) [READWRITE, PERSIST] */

  @type.object.ref("EveSOFDataHullArea")
  hullArea = null;

}

