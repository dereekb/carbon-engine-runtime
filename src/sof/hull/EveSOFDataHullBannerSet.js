import { exposure as be } from "#be";
import { IRoot } from "../../blue/blueexposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type } from "#schema";

/** Groups banner items under a named visibility identity. */
@be.define({
  name: "EveSOFDataHullBannerSet",
  inherit: [ IRoot ],
  // EveSOFData_Blue.cpp:690-694, in Carbon's order.
  members: [
    [ be.PROP_RO, "name" ],
    [ be.ATTR, "visibilityGroup", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "banners", be.READ | be.PERSIST ]
  ]
})
export class EveSOFDataHullBannerSet extends IRoot
{

  /** m_visibilityGroup (BlueSharedString) [READWRITE, PERSIST] */

  @type.string
  visibilityGroup = "primary";

  /** m_banners (PEveSOFDataHullBannerSetItemVector) [READ, PERSIST] */

  @type.list("EveSOFDataHullBannerSetItem")
  banners = [];

  /**
   * Carbon MAP_PROPERTY_READONLY "name" over GetName
   * (EveSOFData_Blue.cpp:692): the banner set's visibility group. Carbon persists no name for
   * this class; the getter derives it.
   *
   * @implemented
   */
  @type.string
  get name()
  {
    return this.GetName();
  }

  /** Uses the banner set's visibility group as its externally comparable name. */

  GetName()
  {
    return this.visibilityGroup;
  }

}
