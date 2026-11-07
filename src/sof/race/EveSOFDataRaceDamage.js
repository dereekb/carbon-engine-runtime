import { exposure as be } from "#be";
import { IRoot } from "../../blue/exposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type } from "#schema";
import { EveSOFDataParameter } from "../shared/EveSOFDataParameter.js";
import { EveSOFDataTexture } from "../shared/EveSOFDataTexture.js";
import { BlueList } from "#blue";

/** Stores, combines, and assigns race-level armor and shield damage parameters and textures. */
@be.define({
  name: "EveSOFDataRaceDamage",
  inherit: [ IRoot ],
  // EveSOFData_Blue.cpp:260-266, in Carbon's order.
  members: [
    [ be.ATTR, "armorImpactParameters", be.READ | be.PERSIST ],
    [ be.ATTR, "armorImpactTextures", be.READ | be.PERSIST ],
    [ be.ATTR, "shieldImpactParameters", be.READ | be.PERSIST ],
    [ be.ATTR, "shieldImpactTextures", be.READ | be.PERSIST ]
  ]
})

export class EveSOFDataRaceDamage extends IRoot
{

  /** m_armorImpactParameters (PEveSOFDataParameterVector) [READ, PERSIST] */

  @type.list("EveSOFDataParameter")
  armorImpactParameters = new BlueList(EveSOFDataParameter, { className: "EveSOFDataParameter" });

  /** m_armorImpactTextures (PEveSOFDataTextureVector) [READ, PERSIST] */

  @type.list("EveSOFDataTexture")
  armorImpactTextures = new BlueList(EveSOFDataTexture, { className: "EveSOFDataTexture" });

  /** m_shieldImpactParameters (PEveSOFDataParameterVector) [READ, PERSIST] */

  @type.list("EveSOFDataParameter")
  shieldImpactParameters = new BlueList(EveSOFDataParameter, { className: "EveSOFDataParameter" });

  /** m_shieldImpactTextures (PEveSOFDataTextureVector) [READ, PERSIST] */

  @type.list("EveSOFDataTexture")
  shieldImpactTextures = new BlueList(EveSOFDataTexture, { className: "EveSOFDataTexture" });

  /**
   * Ensures output maps exist and writes the race's armor-impact parameters and
   * texture paths into them.
   */
  AssignArmor(out)
  {
    out.parameters ??= {};
    out.textures ??= {};
    for (const parameter of this.armorImpactParameters) parameter.Assign(out.parameters);
    for (const texture of this.armorImpactTextures) texture.Assign(out.textures);
    return out;
  }

  /**
   * Ensures output maps exist and writes the race's shield-impact parameters and
   * texture paths into them.
   */
  AssignShield(out)
  {
    out.parameters ??= {};
    out.textures ??= {};
    for (const parameter of this.shieldImpactParameters) parameter.Assign(out.parameters);
    for (const texture of this.shieldImpactTextures) texture.Assign(out.textures);
    return out;
  }

  /**
   * Merges base and override armor and shield parameter and texture lists by
   * authored name into a reusable damage record.
   */
  static combine(base, overrides, out = null)
  {
    out ??= new this();
    base ??= new this();
    EveSOFDataTexture.combineArrays(base.armorImpactTextures, overrides?.armorImpactTextures, out.armorImpactTextures);
    EveSOFDataTexture.combineArrays(base.shieldImpactTextures, overrides?.shieldImpactTextures, out.shieldImpactTextures);
    EveSOFDataParameter.combineArrays(base.armorImpactParameters, overrides?.armorImpactParameters, out.armorImpactParameters);
    EveSOFDataParameter.combineArrays(base.shieldImpactParameters, overrides?.shieldImpactParameters, out.shieldImpactParameters);
    return out;
  }

}
