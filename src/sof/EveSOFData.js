import { exposure as be } from "#be";
import { IRoot } from "../blue/blueexposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type } from "#schema";

/** Root SOF data catalog. */
@be.define({
  name: "EveSOFData",
  inherit: [ IRoot ],
  // EveSOFData_Blue2.cpp:572-581, in Carbon's order.
  members: [
    [ be.ATTR, "generic", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "hull", be.READ | be.PERSIST ],
    [ be.ATTR, "faction", be.READ | be.PERSIST ],
    [ be.ATTR, "race", be.READ | be.PERSIST ],
    [ be.ATTR, "material", be.READ | be.PERSIST ],
    [ be.ATTR, "pattern", be.READ | be.PERSIST ],
    [ be.ATTR, "layout", be.READ | be.PERSIST ]
  ]
})
export class EveSOFData extends IRoot
{

  /** m_faction (PEveSOFDataFactionVector) [READ, PERSIST] */

  @type.list("EveSOFDataFaction")
  faction = [];

  /** m_generic (EveSOFDataGenericPtr) [READWRITE, PERSIST] */

  @type.object.ref("EveSOFDataGeneric")
  generic = null;

  /** m_hull (PEveSOFDataHullVector) [READ, PERSIST] */

  @type.list("EveSOFDataHull")
  hull = [];

  /** m_layout (PEveSOFDataLayoutVector) [READ, PERSIST] */

  @type.list("EveSOFDataLayout")
  layout = [];

  /** m_material (PEveSOFDataMaterialVector) [READ, PERSIST] */

  @type.list("EveSOFDataMaterial")
  material = [];

  /** m_pattern (PEveSOFDataPatternVector) [READ, PERSIST] */

  @type.list("EveSOFDataPattern")
  pattern = [];

  /** m_race (PEveSOFDataRaceVector) [READ, PERSIST] */

  @type.list("EveSOFDataRace")
  race = [];

}
