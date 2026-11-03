import { exposure as be } from "#be";
import { IRoot } from "../../blue/blueexposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type, blue } from "#schema";
import { EveSOFDataFactionColorSet } from "../faction/EveSOFDataFactionColorSet.js";
import { EveSOFDataBooster } from "../shared/EveSOFDataBooster.js";
import { EveSOFDataRaceDamage } from "./EveSOFDataRaceDamage.js";

/** Names a race, stores its heat color, and combines race-level booster and damage configuration. */
@be.define({
  name: "EveSOFDataRace",
  inherit: [ IRoot ],
  // EveSOFData_Blue2.cpp:174-181, in Carbon's order.
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "booster", be.READWRITE | be.PERSIST ],
    [ be.ATTR_CHOOSER, "hullPrimaryHeatColorType", be.READWRITE | be.PERSIST | be.ENUM, "trinity.SOFDataFactionColorChooser.ColorType" ],
    [ be.ATTR_CHOOSER, "hullReactorHeatColorType", be.READWRITE | be.PERSIST | be.ENUM, "trinity.SOFDataFactionColorChooser.ColorType" ],
    [ be.ATTR, "damage", be.READWRITE | be.PERSIST ]
  ]
})

export class EveSOFDataRace extends IRoot
{
  static ColorType = EveSOFDataFactionColorSet.ColorType;


  /**
   * m_hullPrimaryHeatColorType (SOFDataFactionColorChooser::ColorType - enum ColorType) [READWRITE, PERSIST, ENUM]
   * Carbon: MAP_ATTRIBUTE_WITH_CHOOSER (trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue2.cpp:179); chooser EveSOFDataFactionColorSetTypeChooser (trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue.cpp:10).
   */
  @type.int32
  @type.enum("trinity.SOFDataFactionColorChooser.ColorType")
  hullPrimaryHeatColorType = 16;

  /**
   * m_hullReactorHeatColorType (SOFDataFactionColorChooser::ColorType - enum ColorType) [READWRITE, PERSIST, ENUM]
   * Carbon: MAP_ATTRIBUTE_WITH_CHOOSER (trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue2.cpp:180); chooser EveSOFDataFactionColorSetTypeChooser (trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue.cpp:10).
   */
  @type.int32
  @type.enum("trinity.SOFDataFactionColorChooser.ColorType")
  hullReactorHeatColorType = 14;

  /** m_booster (EveSOFDataBoosterPtr) [READWRITE, PERSIST] */

  @type.object.ref("EveSOFDataBooster")
  booster = null;

  /** m_damage (EveSOFDataRaceDamagePtr) [READWRITE, PERSIST] */

  @type.object.ref("EveSOFDataRaceDamage")
  damage = null;

  /** m_name (std::string) [READWRITE, PERSIST] */

  @type.string
  name = "";

  /**
   * Composes the name, heat-color selectors, booster, and damage from base and
   * nonempty overrides into a reusable race record.
   */
  static combine(base, overrides, out = null)
  {
    out ??= new this();
    out.name = selectValue(base, overrides, "name", out.name);
    out.hullPrimaryHeatColorType = selectValue(base, overrides, "hullPrimaryHeatColorType", out.hullPrimaryHeatColorType);
    out.hullReactorHeatColorType = selectValue(base, overrides, "hullReactorHeatColorType", out.hullReactorHeatColorType);
    out.booster = base?.booster || overrides?.booster
      ? EveSOFDataBooster.combine(base?.booster, overrides?.booster, out.booster)
      : null;
    out.damage = base?.damage || overrides?.damage
      ? EveSOFDataRaceDamage.combine(base?.damage, overrides?.damage, out.damage)
      : null;
    return out;
  }

}

function selectValue(base, overrides, name, fallback)
{
  const value = overrides?.[name];
  if (value !== null && value !== undefined && value !== "") return value;
  return base?.[name] ?? fallback;
}
