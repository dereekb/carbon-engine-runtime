import { exposure as be } from "#be";
import { IRoot } from "../../blue/exposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type } from "#schema";
import { BlueList } from "#blue";
import { EveSOFDataGenericString } from "../generic/EveSOFDataGenericString.js";

/** Defines faction visibility-group membership and object-visibility policy. */
@be.define({
  name: "EveSOFDataFactionVisibilityGroupSet",
  inherit: [ IRoot ],
  // EveSOFData_Blue.cpp:406-409, in Carbon's order.
  members: [
    [ be.ATTR, "visibilityGroups", be.READ | be.PERSIST ]
  ]
})

export class EveSOFDataFactionVisibilityGroupSet extends IRoot
{

  /** m_visibilityGroups (PEveSOFDataGenericStringVector) [READ, PERSIST] */

  @type.list("EveSOFDataGenericString")
  visibilityGroups = new BlueList(EveSOFDataGenericString, { className: "EveSOFDataGenericString" });

  /**
   * Accepts a SOF object record and tests its visibilityGroup through this set's
   * normalization rules.
   */
  IsObjectVisible(value)
  {
    if (!value || typeof value !== "object") return false;
    return this.Has(value.visibilityGroup);
  }

  /**
   * Normalizes an empty group to PRIMARY and matches case-insensitively against
   * string or wrapped-string entries.
   */
  Has(visibilityGroup)
  {
    if (typeof visibilityGroup !== "string") return false;
    const normalized = visibilityGroup ? visibilityGroup.toUpperCase() : "PRIMARY";
    return this.visibilityGroups.some(value =>
    {
      const group = typeof value === "string" ? value : value?.str;
      return typeof group === "string" && group.toUpperCase() === normalized;
    });
  }

}
