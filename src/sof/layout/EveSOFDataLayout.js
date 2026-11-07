import { exposure as be } from "#be";
import { IRoot } from "../../blue/exposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type } from "#schema";
import { BlueList } from "#blue";
import { EveSOFDataDistributionDepletionCounter } from "./EveSOFDataDistributionDepletionCounter.js";
import { IEveSOFDataHullExtensionPlacement } from "./IEveSOFDataHullExtensionPlacement.js";

/** Defines a named, seeded top-level layout with placements, counters, and randomization policy. */
@be.define({
  name: "EveSOFDataLayout",
  inherit: [ IRoot ],
  // EveSOFData_Blue2.cpp:299-305, in Carbon's order.
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "seed", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "randomizeSeedOnLoad", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "depletionCounters", be.READ | be.PERSIST ],
    [ be.ATTR, "placements", be.READ | be.PERSIST ]
  ]
})
export class EveSOFDataLayout extends IRoot
{

  /** m_depletionCounters (PEveSOFDataDistributionDepletionCounterVector) [READ, PERSIST] */

  @type.list("EveSOFDataDistributionDepletionCounter")
  depletionCounters = new BlueList(EveSOFDataDistributionDepletionCounter, { className: "EveSOFDataDistributionDepletionCounter" });

  /** m_name (std::string) [READWRITE, PERSIST] */

  @type.string
  name = "";

  /** m_placements (PIEveSOFDataHullExtensionPlacementVector) [READ, PERSIST] */

  @type.list("IEveSOFDataHullExtensionPlacement")
  placements = new BlueList(IEveSOFDataHullExtensionPlacement);

  /** m_randomizeSeedOnLoad (bool) [READWRITE, PERSIST] */

  @type.boolean
  randomizeSeedOnLoad = false;

  /** m_seed (int32_t) [READWRITE, PERSIST] */

  @type.int32
  seed = 1337;

}
