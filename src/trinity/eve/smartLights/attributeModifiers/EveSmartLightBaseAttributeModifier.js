import { IRoot } from "../../../../blue/exposure/IRoot.js";
import { exposure as be } from "#be";
// Source: trinity/trinity/Eve/SpaceObject/Children/SmartLightSets/attributeModifiers/EveSmartLightBaseAttributeModifier.h
import { IsMatch } from "#blue";
import { IInitialize } from "../../../../blue/exposure/IInitialize.js";
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type } from "#schema";
import { INotify } from "#blue";
import { LifeTimeFormulas } from "./enums.js";

/** Power-curve exponents for authored m_crossFadeCurve values: EVE build 3698585 wrote 5 wherever 3682781 wrote an m_crossFadeIntensity of 9.0288. */
const CROSS_FADE_CURVE_EXPONENTS = new Map([ [ 5, Math.fround(9.0288) ] ]);

/** The exponent a modifier's crossfade position is raised to: its authored curve's, else crossFadeIntensity. */
function crossFadeExponent(modifier)
{
  return CROSS_FADE_CURVE_EXPONENTS.get(modifier.crossFadeCurve) ?? modifier.crossFadeIntensity;
}

/** Owns common smart-light activation state and a nominal modifier contract whose optional colour and controller hooks default to no-ops while required update and attribute-processing methods throw until a concrete modifier implements them. */
@be.define({
  name: "EveSmartLightBaseAttributeModifier",
  inherit: [ IInitialize, INotify ],
  // EveSmartLightBaseAttributeModifier_Blue.cpp:21-42, in Carbon's order.
  interfaces: [ IInitialize, INotify ],
  members: [
    [ be.ATTR, "attributeMultiplier", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "active", be.READWRITE | be.PERSIST | be.NOTIFY ],
    [ be.ATTR, "activationOverLifetime", be.READWRITE | be.PERSIST ],
    [ be.ATTR_CHOOSER, "lifeTimeFormula", be.READWRITE | be.PERSIST | be.ENUM, "trinity.LifetimeFormula" ],
    [ be.ATTR, "perInstanceOffset", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "restartPlayTimeWhenInactive", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "playTime", be.READ ],
    [ be.ATTR, "startsActive", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "delayedActivation", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "crossFadeDuration", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "crossFadeIntensity", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "activationValue", be.READ ],
    [ be.ATTR, "finalAttributeMultiplier", be.READ ]
  ]
})
export class EveSmartLightBaseAttributeModifier extends IRoot
{

  /**
   * m_lifeTimeFormula (LifeTimeFormulas - enum LifeTimeFormulas) [READWRITE, PERSIST, ENUM]
   * Carbon: MAP_ATTRIBUTE_WITH_CHOOSER (trinity/trinity/Eve/SpaceObject/Children/SmartLightSets/attributeModifiers/EveSmartLightBaseAttributeModifier_Blue.cpp:30); chooser LifetimeFormulaChooser (trinity/trinity/Eve/SpaceObject/Children/SmartLightSets/attributeModifiers/EveSmartLightBaseAttributeModifier_Blue.cpp:6).
   */
  @type.int32
  @type.enum("trinity.LifetimeFormula")
  lifeTimeFormula = 0;

  /** m_activationOverLifetime (Tr2CurveScalarPtr) [READWRITE, PERSIST] */

  @type.object.ref("Tr2CurveScalar")
  activationOverLifetime = null;

  /** m_activationValue (float) [READ] */
  @type.float32
  activationValue = 1;

  /** m_playTime (float) [READ] */
  @type.float32
  playTime = 0;

  /** m_crossFadeDuration (float) [READWRITE, PERSIST] */

  @type.float32
  crossFadeDuration = 1;

  /** m_crossFadeIntensity (float) [READWRITE, PERSIST] */

  @type.float32
  crossFadeIntensity = 1;

  /**
   * m_crossFadeCurve (int) [READWRITE, PERSIST]
   *
   * EVE build 3698585 authors this in place of m_crossFadeIntensity, and the
   * canonical Black reader refused every record carrying it (the racial primary
   * spotlight sets, so every hull naming one). Its 44 authored values are all 5,
   * each on a modifier 3682781 authored with an intensity of 9.0288. Carbon's
   * curve enum is not known here: a value in CROSS_FADE_CURVE_EXPONENTS keeps the
   * power curve its intensity gave; 0 (unwritten) and any other value use
   * crossFadeIntensity, which older builds author. Not in Carbon's exposure block,
   * so it sits outside the class's bag.
   *
   * @adapted EVE build 3698585's field, newer than the Carbon source
   */
  @be.mapAttribute(be.READWRITE | be.PERSIST)
  @type.int32
  crossFadeCurve = 0;

  /** m_perInstanceOffset (float) [READWRITE, PERSIST] */

  @type.float32
  perInstanceOffset = 0;

  /** m_activationStrength (float) [READWRITE, PERSIST] */

  @type.float32
  attributeMultiplier = 1;

  /** m_startsActive (bool) [READWRITE, PERSIST] */

  @type.boolean
  startsActive = true;

  /** m_restartPlayTimeWhenInactive (bool) [READWRITE, PERSIST] */

  @type.boolean
  restartPlayTimeWhenInactive = true;

  /** m_finalActivationStrength (float) [READ] */
  @type.float32
  finalAttributeMultiplier = 1;

  /** m_active (bool) [READWRITE, PERSIST, NOTIFY] */


  @type.boolean
  active = true;

  /** m_delayedActivation (float) [READWRITE, PERSIST] */

  @type.float32
  delayedActivation = 0;

  /**
   * m_activationDelay (float) [READWRITE, PERSIST]
   *
   * EVE build 3698585 renamed m_delayedActivation to m_activationDelay
   * (gca2_t1_pride_gallente_fx: same bytes, new name), and the canonical Black
   * reader refused it. A nonzero activationDelay wins, else delayedActivation,
   * which older builds author. Not in Carbon's exposure block, so it sits outside
   * the class's bag.
   *
   * @adapted EVE build 3698585's rename, newer than the Carbon source
   */
  @be.mapAttribute(be.READWRITE | be.PERSIST)
  @type.float32
  activationDelay = 0;

  // Carbon-protected crossfade state (EveSmartLightBaseAttributeModifier.h:47-60).
  // subclasses write them (EveSmartLightAttributeModifierBucket::SetActive);
  // the rest is private.

  /** m_isChangingActivation (bool) - crossfade in progress (EveSmartLightBaseAttributeModifier.h:49). */
  _isChangingActivation = false;

  /** Last `active` value applied by an edit path (JS-only change detection for the settle hook). */

  /** m_activationValuePreMapped (float) - linear crossfade position before intensity mapping (h:57). */
  _activationValuePreMapped = 1;

  /** m_lastActivationTimeStamp (float) - playTime captured on the last (de)activation (h:60). */
  _lastActivationTimeStamp = 0;

  /**
   * Seeds the crossfade state machine: a modifier authored active but not
   * starting active animates into its active state
   * (EveSmartLightBaseAttributeModifier.cpp:27-33).
   *
   * @implemented
   */

  Initialize()
  {
    this._isChangingActivation = this.active && !this.startsActive;
    this._activationValuePreMapped = this._isChangingActivation ? 0 : (this.active ? 1 : 0);
    this.MapActivationValue();
    return true;
  }

  /**
   * Reacts to an `active` edit by restarting the crossfade from the current
   * (unmapped) position (EveSmartLightBaseAttributeModifier.cpp:35-48). The
   * exponent comes through crossFadeExponent (adapted for EVE build 3698585's
   * m_crossFadeCurve).
   *
   * @implemented
   */

  OnModified(propertyName)
  {
    if (IsMatch(propertyName, "active"))
    {
      this._isChangingActivation = true;
      const exponent = crossFadeExponent(this);
      if (exponent > 0)
      {
        this._activationValuePreMapped = Math.pow(this._activationValuePreMapped, 1 / exponent);
      }
      this.ResetPlayTime(this.active);
    }
    return true;
  }

  /**
   * Applies an activation state, optionally restarting the play time
   * (EveSmartLightBaseAttributeModifier.cpp:50-63).
   *
   * @implemented
   */

  ResetPlayTime(active)
  {
    if (active !== this.active)
    {
      this._isChangingActivation = true;
    }

    this.active = active;
    if (this.restartPlayTimeWhenInactive && !this.active)
    {
      this.playTime = 0;
    }
    this._lastActivationTimeStamp = this.playTime;
  }

  /**
   * Maps the linear crossfade position through the intensity power curve,
   * mirrored around the deactivating direction
   * (EveSmartLightBaseAttributeModifier.cpp:65-70). The exponent comes through
   * crossFadeExponent (adapted for EVE build 3698585's m_crossFadeCurve).
   *
   * @implemented
   */

  MapActivationValue()
  {
    const scaleValue = this.active ? this._activationValuePreMapped : 1 - this._activationValuePreMapped;
    const mapped = Math.pow(scaleValue, crossFadeExponent(this));
    this.activationValue = this.active ? mapped : 1 - mapped;
  }

  /**
   * Advances the crossfade/delayed-activation state machine and folds the
   * parent multiplier into the final activation strength
   * (EveSmartLightBaseAttributeModifier.cpp:72-125). The delay is a nonzero
   * activationDelay, else delayedActivation (adapted for EVE build 3698585's
   * rename).
   *
   * @implemented
   */

  UpdateActivationStrength(parentActivationMultiplier, deltaTime)
  {
    if (this._isChangingActivation)
    {
      const activationTime = this._lastActivationTimeStamp + (this.activationDelay || this.delayedActivation);
      if (this.playTime < activationTime && this.active)
      {
        if (parentActivationMultiplier > 0)
        {
          this.playTime += deltaTime;
        }
        return;
      }

      if (this.crossFadeDuration === 0)
      {
        this._activationValuePreMapped = this.active ? 1 : 0;
      }
      else
      {
        let valueAdjustment = deltaTime / this.crossFadeDuration;
        valueAdjustment = this.active ? valueAdjustment : -valueAdjustment;
        this._activationValuePreMapped = Math.min(1, Math.max(0, this._activationValuePreMapped + valueAdjustment));
      }

      this.MapActivationValue();

      const finishedActivating = this.active && this._activationValuePreMapped >= 1;
      const finishedDeActivating = !this.active && this._activationValuePreMapped <= 0;

      if (finishedActivating || finishedDeActivating)
      {
        this._isChangingActivation = false;
        if (finishedDeActivating && this.restartPlayTimeWhenInactive)
        {
          this.ResetChildren(false);
        }
        if (finishedActivating)
        {
          this.ResetChildren(true);
        }
      }
    }

    this.finalAttributeMultiplier = parentActivationMultiplier * this.attributeMultiplier * this.activationValue;

    if (this.finalAttributeMultiplier > 0)
    {
      this.playTime += deltaTime;
    }
  }

  /**
   * Final activation strength for one placement, multiplied by the optional
   * lifetime curve sampled per the lifetime formula
   * (EveSmartLightBaseAttributeModifier.cpp:127-151).
   *
   * @implemented
   */

  GetActivationStrength(placement)
  {
    let activationMultiplier = 1;

    if (this.activationOverLifetime)
    {
      // The placement is read unchecked and the sums are float, as Carbon's are
      // (cpp:133-140; rulings 12 and 2026-10-16).
      const idOffset = Math.fround(Math.fround(placement.initialPlacementID) * this.perInstanceOffset);
      switch (this.lifeTimeFormula)
      {
        case EveSmartLightBaseAttributeModifier.LifeTimeFormulas.PER_INSTANCE_LIFETIME:
          activationMultiplier = this.activationOverLifetime.GetValueAt(Math.fround(placement.lifeTime + idOffset));
          break;
        case EveSmartLightBaseAttributeModifier.LifeTimeFormulas.PER_MODIFIER_PLAYTIME:
          activationMultiplier = this.activationOverLifetime.GetValueAt(Math.fround(this.playTime + idOffset));
          break;
        case EveSmartLightBaseAttributeModifier.LifeTimeFormulas.STATIC:
          activationMultiplier = this.activationOverLifetime.GetValueAt(idOffset);
          break;
        default:
          break;
      }
    }

    return this.finalAttributeMultiplier * activationMultiplier;
  }

  /**
   * Carbon declares ResetChildren inline empty on the base (EveSmartLightBaseAttributeModifier.h:41).
   *
   * @adapted
   */

  ResetChildren(_parentActive)
  {
  }

  static LifeTimeFormulas = LifeTimeFormulas;

}
