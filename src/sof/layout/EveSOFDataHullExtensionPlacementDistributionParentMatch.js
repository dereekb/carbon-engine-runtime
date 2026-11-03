// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
import { exposure as be } from "#be";
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type } from "#schema";
import { EveSOFDNADescriptor } from "../shared/EveSOFDNADescriptor.js";
import { IEveSOFDataHullExtensionPlacementDistribution } from "./IEveSOFDataHullExtensionPlacementDistribution.js";

/** Matches a parent DNA descriptor as a condition for a hull-extension placement. */
@be.define({
  name: "EveSOFDataHullExtensionPlacementDistributionParentMatch",
  // EveSOFData_Blue2.cpp:335-339, in Carbon's order.
  interfaces: [ IEveSOFDataHullExtensionPlacementDistribution ],
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "parentDescriptor", be.READWRITE | be.PERSIST ]
  ]
})
export class EveSOFDataHullExtensionPlacementDistributionParentMatch extends IEveSOFDataHullExtensionPlacementDistribution
{

  /** m_parentDescriptor (EveSOFDNADescriptorPtr) [READWRITE, PERSIST] */

  @type.object.ref("EveSOFDNADescriptor")
  parentDescriptor = new EveSOFDNADescriptor();

  /** m_name (std::string) [READWRITE, PERSIST] */

  @type.string
  name = "";

}
