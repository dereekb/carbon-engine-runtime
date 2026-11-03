// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
import { exposure as be } from "#be";
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type } from "#schema";
import { IEveSOFDataHullLocatorSet } from "./IEveSOFDataHullLocatorSet.js";

/** Provides a concrete named list of hull locators. */
@be.define({
  name: "EveSOFDataHullLocatorSet",
  // EveSOFData_Blue.cpp:794-799, in Carbon's order.
  interfaces: [ IEveSOFDataHullLocatorSet ],
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "locators", be.READ | be.PERSIST ]
  ]
})
export class EveSOFDataHullLocatorSet extends IEveSOFDataHullLocatorSet
{

  /** m_locators (PEveSOFDataTransformVector) [READ, PERSIST] */

  @type.list("EveSOFDataTransform")
  locators = [];

  /** m_name (BlueSharedString) [READWRITE, PERSIST] */

  @type.string
  name = "";

}
