import { exposure as be } from "#be";
import { IRoot } from "../../../../blue/exposure/IRoot.js";
// Source: trinity/trinity/Eve/EveMultiEffectParameter.h
// Source: trinity/trinity/Eve/EveMultiEffectParameter.cpp
// Source: trinity/trinity/Eve/EveMultiEffectParameter_Blue.cpp
import { INotify } from "../../../../blue/exposure/INotify.js";
import { CjsSchema, type } from "#schema";
import { EveEffectRoot2 } from "../../spaceObject/EveEffectRoot2.js";
import { EveSpaceObject2 } from "../../spaceObject/EveSpaceObject2.js";
import { ParameterType } from "../../../generated/eve/enums.js";
import { IsMatch, blue } from "#blue";

/**
 * One named slot in an EveMultiEffect, holding the object bound to that name
 * together with the object type the effect expects there.
 */
@be.define({
  name: "EveMultiEffectParameter",
  inherit: [ INotify ],
  // EveMultiEffectParameter_Blue.cpp:20-26, in Carbon's order.
  interfaces: [ INotify ],
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "object", be.READWRITE | be.NOTIFY ],
    [ be.ATTR_CHOOSER, "type", be.READWRITE | be.ENUM, "trinity.EveMultiEffectParameter.ParameterType" ],
    [ be.PROP_RO, "isValid" ]
  ]
})
export class EveMultiEffectParameter extends IRoot
{
  /** Carbon: MAP_ATTRIBUTE_WITH_CHOOSER (trinity/trinity/Eve/EveMultiEffectParameter_Blue.cpp:25); chooser EveMultiEffectParameterTypeChooser (trinity/trinity/Eve/EveMultiEffectParameter_Blue.cpp:8). */
  @type.int32
  @type.enum("trinity.EveMultiEffectParameter.ParameterType")
  type = 3;

  @type.string
  name = "";

  @type.object.ref("IRoot")
  object = null;

  _owner = null;

  /**
   * Carbon MAP_PROPERTY_READONLY "isValid" over IsValid
   * (EveMultiEffectParameter_Blue.cpp:26): whether the bound object matches
   * the declared parameter type.
   *
   * @implemented
   */
  @type.boolean
  get isValid()
  {
    return this.IsValid();
  }

  /**
   * Binds an object to this slot, or clears it when given nothing.
   *
   * @implemented
   */

  SetParameterObject(object)
  {
    this.object = object ?? null;
  }

  /**
   * Whether the bound object matches the declared parameter type; TYPE_ANYTHING
   * accepts any non-null object, and an unrecognised type accepts none
   * (Carbon's BlueCastPtr to the concrete class).
   *
   * @implemented
   */

  IsValid()
  {
    if (!this.object) return false;
    switch (this.type)
    {
      case EveMultiEffectParameter.ParameterType.TYPE_EVESPACEOBJECT:
        return CjsSchema.cast(this.object, EveSpaceObject2) !== null;
      case EveMultiEffectParameter.ParameterType.TYPE_EVEEFFECTROOT:
        return CjsSchema.cast(this.object, EveEffectRoot2) !== null;
      case EveMultiEffectParameter.ParameterType.TYPE_ANYTHING:
        return true;
      default:
        return false;
    }
  }

  /**
   * Sets the effect rebound when this slot's object changes; passing nothing
   * detaches the slot.
   *
   * @implemented
   */

  SetOwner(owner)
  {
    this._owner = owner ?? null;
  }

  /**
   * The object bound to this slot, or null.
   *
   * @implemented
   */

  GetParameterObject()
  {
    return this.object;
  }

  /**
   * The name bindings and controllers use to reach this slot.
   *
   * @implemented
   */

  GetName()
  {
    return this.name;
  }

  /**
   * Rebinds the owning effect after a model update, since the bound object is
   * the slot's only notifying field.
   *
   * @implemented
   */

  OnModified(propertyName)
  {
    if (IsMatch(propertyName, "object") && this._owner) this._owner.Rebind();
    return true;
  }

  static ParameterType = ParameterType;

}


// Exact native Blue exposure: only these identities participate in loading.
