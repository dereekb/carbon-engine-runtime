import { exposure as be } from "#be";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type, blue } from "#schema";
import { IEveSOFDataHullExtensionPlacementDistribution } from "./IEveSOFDataHullExtensionPlacementDistribution.js";

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
  depletionCounters = [];

  /** m_name (std::string) [READWRITE, PERSIST] */

  @type.string
  name = "";

}
