// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
import { exposure as be } from "#be";
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type } from "#schema";
import { IEveSOFDataHullExtensionPlacementDistribution } from "./IEveSOFDataHullExtensionPlacementDistribution.js";
import { BlueList } from "#blue";
import { EveSOFDataDistributionDepletionCounter } from "./EveSOFDataDistributionDepletionCounter.js";

/** Tests named depletion counters as a condition for a hull-extension placement. */
@be.define({
  name: "EveSOFDataHullExtensionPlacementDistributionDepletionCounter",
  // EveSOFData_Blue2.cpp:345-349, in Carbon's order.
  interfaces: [ IEveSOFDataHullExtensionPlacementDistribution ],
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "depletionCounters", be.READ | be.PERSIST ]
  ]
})
export class EveSOFDataHullExtensionPlacementDistributionDepletionCounter extends IEveSOFDataHullExtensionPlacementDistribution
{

  /** m_depletionCounters (PEveSOFDataDistributionDepletionCounterVector) [READ, PERSIST] */

  @type.list("EveSOFDataDistributionDepletionCounter")
  depletionCounters = new BlueList(EveSOFDataDistributionDepletionCounter, { className: "EveSOFDataDistributionDepletionCounter" });

  /** m_name (std::string) [READWRITE, PERSIST] */

  @type.string
  name = "";

}
