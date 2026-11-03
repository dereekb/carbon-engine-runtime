import { exposure as be } from "#be";
import { IRoot } from "../../blue/blueexposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type } from "#schema";

/** Aggregates a faction's area, color, logo, pattern, material-slot, visibility, plane, spotlight, child, and resource-path configuration. */
@be.define({
  name: "EveSOFDataFaction",
  inherit: [ IRoot ],
  // EveSOFData_Blue2.cpp:146-166, in Carbon's order.
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "description", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "resPathInsert", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "areaTypes", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "colorSet", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "logoSet", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "spotlightSets", be.READ | be.PERSIST ],
    [ be.ATTR, "planeSets", be.READ | be.PERSIST ],
    [ be.ATTR, "children", be.READ | be.PERSIST ],
    [ be.ATTR, "visibilityGroupSet", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "materialUsageMtl1", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "materialUsageMtl2", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "materialUsageMtl3", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "materialUsageMtl4", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "defaultPattern", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "defaultPatternLayer1MaterialName", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "defaultPatternLayer2MaterialName", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "defaultPatternName", be.READWRITE | be.PERSIST ]
  ]
})

export class EveSOFDataFaction extends IRoot
{

  /** m_areaTypes (EveSOFDataAreaPtr) [READWRITE, PERSIST] */

  @type.object.ref("EveSOFDataArea")
  areaTypes = null;

  /** m_colorSet (EveSOFDataFactionColorSetPtr) [READWRITE, PERSIST] */

  @type.object.ref("EveSOFDataFactionColorSet")
  colorSet = null;

  /** m_logoSet (EveSOFDataLogoSetPtr) [READWRITE, PERSIST] */

  @type.object.ref("EveSOFDataLogoSet")
  logoSet = null;

  /** m_description (std::string) [READWRITE, PERSIST] */

  @type.string
  description = "";

  /** m_children (PEveSOFDataFactionChildVector) [READ, PERSIST] */

  @type.list("EveSOFDataFactionChild")
  children = [];

  /** m_planeSets (PEveSOFDataFactionPlaneSetVector) [READ, PERSIST] */

  @type.list("EveSOFDataFactionPlaneSet")
  planeSets = [];

  /** m_spotlightSets (PEveSOFDataFactionSpotlightSetVector) [READ, PERSIST] */

  @type.list("EveSOFDataFactionSpotlightSet")
  spotlightSets = [];

  /** m_visibilityGroupSet (EveSOFDataFactionVisibilityGroupSetPtr) [READWRITE, PERSIST] */

  @type.object.ref("EveSOFDataFactionVisibilityGroupSet")
  visibilityGroupSet = null;

  /** m_resPathInsert (std::string) [READWRITE, PERSIST] */

  @type.string
  resPathInsert = "";

  /** m_materialUsageMtl1 (int32_t) [READWRITE, PERSIST] */

  @type.int32
  materialUsageMtl1 = 0;

  /** m_materialUsageMtl2 (int32_t) [READWRITE, PERSIST] */

  @type.int32
  materialUsageMtl2 = 1;

  /** m_materialUsageMtl3 (int32_t) [READWRITE, PERSIST] */

  @type.int32
  materialUsageMtl3 = 2;

  /** m_materialUsageMtl4 (int32_t) [READWRITE, PERSIST] */

  @type.int32
  materialUsageMtl4 = 3;

  /** m_defaultPattern (EveSOFDataPatternLayerPtr) [READWRITE, PERSIST] */

  @type.object.ref("EveSOFDataPatternLayer")
  defaultPattern = null;

  /** m_defaultPatternLayer1MaterialName (std::string) [READWRITE, PERSIST] */

  @type.string
  defaultPatternLayer1MaterialName = "";

  /** m_defaultPatternLayer2MaterialName (std::string) [READWRITE, PERSIST] */

  @type.string
  defaultPatternLayer2MaterialName = "";

  /** m_defaultPatternName (std::string) [READWRITE, PERSIST] */

  @type.string
  defaultPatternName = "";

  /** m_name (std::string) [READWRITE, PERSIST] */

  @type.string
  name = "";

  /**
   * Tests whether the faction visibility table contains the requested group
   * name.
   */
  HasVisibilityGroup(name)
  {
    return this.visibilityGroupSet ? this.visibilityGroupSet.Has(name) : false;
  }

  /**
   * Applies the faction visibility table to an object's visibility-group
   * membership.
   */
  IsObjectVisible(value)
  {
    return this.visibilityGroupSet ? this.visibilityGroupSet.IsObjectVisible(value) : false;
  }

  /**
   * Selects the first authored plane-set override with the requested group
   * index, or null.
   */
  FindPlaneSetByGroupIndex(groupIndex)
  {
    return this.planeSets?.find(value => value?.groupIndex === groupIndex) ?? null;
  }

  /**
   * Selects the first authored spotlight-set override with the requested group
   * index, or null.
   */
  FindSpotlightSetByGroupIndex(groupIndex)
  {
    return this.spotlightSets?.find(value => value?.groupIndex === groupIndex) ?? null;
  }

}
