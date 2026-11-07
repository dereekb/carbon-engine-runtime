import { IRoot } from "../../blue/exposure/IRoot.js";
import { exposure as be } from "#be";
import { IEveSOFDataHullExtensionPlacement } from "./IEveSOFDataHullExtensionPlacement.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type } from "#schema";
import { BlueList } from "#blue";
import { EveSOFDataDistributionDepletionCounter } from "./EveSOFDataDistributionDepletionCounter.js";
import { IEveSOFDataHullExtensionPlacementDistribution } from "./IEveSOFDataHullExtensionPlacementDistribution.js";

/** Groups enabled nested placements with group-level conditions and depletion counters. */
@be.define({
  name: "EveSOFDataHullExtensionPlacementGroup",
  inherit: [ IEveSOFDataHullExtensionPlacement ],
  // EveSOFData_Blue2.cpp:286-293, in Carbon's order.
  interfaces: [ IEveSOFDataHullExtensionPlacement ],
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "enabled", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "placements", be.READ | be.PERSIST ],
    [ be.ATTR, "distributionConditions", be.READ | be.PERSIST ],
    [ be.ATTR, "depletionCounters", be.READ | be.PERSIST ]
  ]
})
export class EveSOFDataHullExtensionPlacementGroup extends IRoot
{

  /** m_placements (PIEveSOFDataHullExtensionPlacementVector) [READ, PERSIST] */

  @type.list("IEveSOFDataHullExtensionPlacement")
  placements = [];

  /** m_distributionConditions (PIEveSOFDataHullExtensionPlacementDistributionVector) [READ, PERSIST] */

  @type.list("IEveSOFDataHullExtensionPlacementDistribution")
  distributionConditions = new BlueList(IEveSOFDataHullExtensionPlacementDistribution);

  /** m_depletionCounters (PEveSOFDataDistributionDepletionCounterVector) [READ, PERSIST] */

  @type.list("EveSOFDataDistributionDepletionCounter")
  depletionCounters = new BlueList(EveSOFDataDistributionDepletionCounter, { className: "EveSOFDataDistributionDepletionCounter" });

  /** m_enabled (bool) [READWRITE, PERSIST] */

  @type.boolean
  enabled = true;

  /** m_name (std::string) [READWRITE, PERSIST] */

  @type.string
  name = "";

}
