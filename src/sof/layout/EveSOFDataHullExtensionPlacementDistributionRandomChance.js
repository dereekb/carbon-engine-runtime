// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
import { exposure as be } from "#be";
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type } from "#schema";
import { IEveSOFDataHullExtensionPlacementDistribution } from "./IEveSOFDataHullExtensionPlacementDistribution.js";

/** Applies a probability threshold as a condition for a hull-extension placement. */
@be.define({
  name: "EveSOFDataHullExtensionPlacementDistributionRandomChance",
  // EveSOFData_Blue2.cpp:355-359, in Carbon's order.
  interfaces: [ IEveSOFDataHullExtensionPlacementDistribution ],
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "chanceOfUsage", be.READWRITE | be.PERSIST ]
  ]
})
export class EveSOFDataHullExtensionPlacementDistributionRandomChance extends IEveSOFDataHullExtensionPlacementDistribution
{

  /** m_chanceOfUsage (float) [READWRITE, PERSIST] */

  @type.float32
  chanceOfUsage = 1;

  /** m_name (std::string) [READWRITE, PERSIST] */

  @type.string
  name = "";

}
