import { exposure as be } from "#be";
import { IRoot } from "../../blue/blueexposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type, blue } from "#schema";
import { mat4 } from "#math/mat4";

/** Stores a named hull locator and its transformation matrix. */
@be.define({
  name: "EveSOFDataHullLocator",
  inherit: [ IRoot ],
  // EveSOFData_Blue.cpp:782-786, in Carbon's order.
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "transform", be.READWRITE | be.PERSIST ]
  ]
})
export class EveSOFDataHullLocator extends IRoot
{

  /** m_name (BlueSharedString) [READWRITE, PERSIST] */

  @type.string
  name = "";

  /** m_transform (Matrix) [READWRITE, PERSIST] */

  @type.mat4
  transform = mat4.create();

}
