import { IRoot } from "../../blue/blueexposure/IRoot.js";
import { exposure as be } from "#be";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h:177-243
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.cpp:42-52
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue.cpp:10-56, 153-198
import { type } from "#schema";
import { ColorType } from "#consts/graphics";
import { color } from "#math/color";
import { vec4 } from "#math/vec4";


/**
 * A faction's colour palette: `Color m_colors[TYPE_MAX]`, exposed by chooser
 * name. Declarations keep the order this class has always exported.
 */
@be.define({
  name: "EveSOFDataFactionColorSet",
  inherit: [ IRoot ],
  // EveSOFData_Blue.cpp:153-199, in Carbon's order.
  members: [
    [ be.ATTR_INDEX, "Primary", be.READWRITE | be.PERSIST, ColorType.TYPE_PRIMARY, "colors" ],
    [ be.ATTR_INDEX, "Secondary", be.READWRITE | be.PERSIST, ColorType.TYPE_SECONDARY, "colors" ],
    [ be.ATTR_INDEX, "Tertiary", be.READWRITE | be.PERSIST, ColorType.TYPE_TERTIARY, "colors" ],
    [ be.ATTR_INDEX, "Black", be.READWRITE | be.PERSIST, ColorType.TYPE_BLACK, "colors" ],
    [ be.ATTR_INDEX, "White", be.READWRITE | be.PERSIST, ColorType.TYPE_WHITE, "colors" ],
    [ be.ATTR_INDEX, "Yellow", be.READWRITE | be.PERSIST, ColorType.TYPE_YELLOW, "colors" ],
    [ be.ATTR_INDEX, "Orange", be.READWRITE | be.PERSIST, ColorType.TYPE_ORANGE, "colors" ],
    [ be.ATTR_INDEX, "Red", be.READWRITE | be.PERSIST, ColorType.TYPE_RED, "colors" ],
    [ be.ATTR_INDEX, "Blue", be.READWRITE | be.PERSIST, ColorType.TYPE_BLUE, "colors" ],
    [ be.ATTR_INDEX, "Green", be.READWRITE | be.PERSIST, ColorType.TYPE_GREEN, "colors" ],
    [ be.ATTR_INDEX, "Cyan", be.READWRITE | be.PERSIST, ColorType.TYPE_CYAN, "colors" ],
    [ be.ATTR_INDEX, "Fire", be.READWRITE | be.PERSIST, ColorType.TYPE_FIRE, "colors" ],
    [ be.ATTR_INDEX, "Hull", be.READWRITE | be.PERSIST, ColorType.TYPE_HULL, "colors" ],
    [ be.ATTR_INDEX, "Glass", be.READWRITE | be.PERSIST, ColorType.TYPE_GLASS, "colors" ],
    [ be.ATTR_INDEX, "Reactor", be.READWRITE | be.PERSIST, ColorType.TYPE_REACTOR, "colors" ],
    [ be.ATTR_INDEX, "Darkhull", be.READWRITE | be.PERSIST, ColorType.TYPE_DARKHULL, "colors" ],
    [ be.ATTR_INDEX, "Booster", be.READWRITE | be.PERSIST, ColorType.TYPE_BOOSTER, "colors" ],
    [ be.ATTR_INDEX, "Killmark", be.READWRITE | be.PERSIST, ColorType.TYPE_KILLMARK, "colors" ],
    [ be.ATTR_INDEX, "PrimaryLight", be.READWRITE | be.PERSIST, ColorType.TYPE_PRIMARY_LIGHT, "colors" ],
    [ be.ATTR_INDEX, "SecondaryLight", be.READWRITE | be.PERSIST, ColorType.TYPE_SECONDARY_LIGHT, "colors" ],
    [ be.ATTR_INDEX, "TertiaryLight", be.READWRITE | be.PERSIST, ColorType.TYPE_TERTIARY_LIGHT, "colors" ],
    [ be.ATTR_INDEX, "WhiteLight", be.READWRITE | be.PERSIST, ColorType.TYPE_WHITE_LIGHT, "colors" ],
    [ be.ATTR_INDEX, "PrimarySpotlight", be.READWRITE | be.PERSIST, ColorType.TYPE_PRIMARY_SPOTLIGHT, "colors" ],
    [ be.ATTR_INDEX, "SecondarySpotlight", be.READWRITE | be.PERSIST, ColorType.TYPE_SECONDARY_SPOTLIGHT, "colors" ],
    [ be.ATTR_INDEX, "TertiarySpotlight", be.READWRITE | be.PERSIST, ColorType.TYPE_TERTIARY_SPOTLIGHT, "colors" ],
    [ be.ATTR_INDEX, "PrimaryHologram", be.READWRITE | be.PERSIST, ColorType.TYPE_PRIMARY_HOLOGRAM, "colors" ],
    [ be.ATTR_INDEX, "SecondaryHologram", be.READWRITE | be.PERSIST, ColorType.TYPE_SECONDARY_HOLOGRAM, "colors" ],
    [ be.ATTR_INDEX, "TertiaryHologram", be.READWRITE | be.PERSIST, ColorType.TYPE_TERTIARY_HOLOGRAM, "colors" ],
    [ be.ATTR_INDEX, "State0", be.READWRITE | be.PERSIST, ColorType.TYPE_STATE_0, "colors" ],
    [ be.ATTR_INDEX, "State1", be.READWRITE | be.PERSIST, ColorType.TYPE_STATE_1, "colors" ],
    [ be.ATTR_INDEX, "State2", be.READWRITE | be.PERSIST, ColorType.TYPE_STATE_2, "colors" ],
    [ be.ATTR_INDEX, "State3", be.READWRITE | be.PERSIST, ColorType.TYPE_STATE_3, "colors" ],
    [ be.ATTR_INDEX, "StateVulnerable", be.READWRITE | be.PERSIST, ColorType.TYPE_STATE_VULNERABLE, "colors" ],
    [ be.ATTR_INDEX, "StateInvulnerable", be.READWRITE | be.PERSIST, ColorType.TYPE_STATE_INVULNERABLE, "colors" ],
    [ be.ATTR_INDEX, "PrimaryForcefield", be.READWRITE | be.PERSIST, ColorType.TYPE_PRIMARY_FORCEFIELD, "colors" ],
    [ be.ATTR_INDEX, "SecondaryForcefield", be.READWRITE | be.PERSIST, ColorType.TYPE_SECONDARY_FORCEFIELD, "colors" ],
    [ be.ATTR_INDEX, "PrimaryBanner", be.READWRITE | be.PERSIST, ColorType.TYPE_PRIMARY_BANNER, "colors" ],
    [ be.ATTR_INDEX, "PrimaryBillboard", be.READWRITE | be.PERSIST, ColorType.TYPE_PRIMARY_BILLBOARD, "colors" ],
    [ be.ATTR_INDEX, "PrimaryFx", be.READWRITE | be.PERSIST, ColorType.TYPE_PRIMARY_FX, "colors" ],
    [ be.ATTR_INDEX, "SecondaryFx", be.READWRITE | be.PERSIST, ColorType.TYPE_SECONDARY_FX, "colors" ],
    [ be.ATTR_INDEX, "PrimaryWarpFx", be.READWRITE | be.PERSIST, ColorType.TYPE_PRIMARY_WARP_FX, "colors" ],
    [ be.ATTR_INDEX, "PrimaryAttackFX", be.READWRITE | be.PERSIST, ColorType.TYPE_PRIMARY_ATTACK_FX, "colors" ],
    [ be.ATTR_INDEX, "PrimarySiegeFX", be.READWRITE | be.PERSIST, ColorType.TYPE_PRIMARY_SIEGE_FX, "colors" ],
    [ be.ATTR_INDEX, "PrimaryDockedFX", be.READWRITE | be.PERSIST, ColorType.TYPE_PRIMARY_DOCKED_FX, "colors" ]
  ]
})
export class EveSOFDataFactionColorSet extends IRoot
{
  static ColorType = ColorType;

  /**
   * m_colors: one linear colour per ColorType. The constructor fills every
   * slot with (0, 0, 0, 1), then sets the authored defaults (EveSOFData.cpp:42-51).
   * @type {Array<Float32Array>}
   */
  @type.array({ kind: "color" })
  colors = EveSOFDataFactionColorSet.createColors();

  /**
   * Builds the default slot array.
   *
   * Custom: JavaScript factory for the constructor's array fill.
   * @returns {Array<Float32Array>} One colour per ColorType.
   */
  static createColors()
  {
    const colors = Array.from({ length: ColorType.TYPE_MAX }, () => color.createLinear());
    colors[ColorType.TYPE_PRIMARY_WARP_FX] = vec4.fromValues(1, 99 / 255, 51 / 255, 1);
    colors[ColorType.TYPE_PRIMARY_ATTACK_FX] = vec4.fromValues(1, 24 / 255, 11 / 255, 1);
    colors[ColorType.TYPE_PRIMARY_SIEGE_FX] = vec4.fromValues(1, 94 / 255, 45 / 255, 1);
    colors[ColorType.TYPE_PRIMARY_DOCKED_FX] = vec4.fromValues(76 / 255, 130 / 255, 226 / 255, 1);
    colors[ColorType.TYPE_PRIMARY_BILLBOARD] = vec4.fromValues(2.5, 2.5, 2.5, 2.5);
    return colors;
  }
}

