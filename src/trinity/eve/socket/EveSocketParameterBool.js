// Source: trinity/trinity/Eve/SpaceObject/Children/SocketParameters/EveSocketParameter.h
import { exposure as be } from "#be";
// Hand-authored following the eve/socket generated pattern (SOCKET_PARAM_DECLARE macro family).
import { IEveSocketParameter } from "./IEveSocketParameter.js";
import { type } from "#schema";
import { EveSocketParameterBindingBase } from "./EveSocketParameterBindingBase.js";

/** Binds a named boolean socket value to external parameters, capturing and restoring each binding's previous value. */
@be.define({
  name: "EveSocketParameterBool",
  // EveSocketParameter_Blue.cpp:33-33, in Carbon's order.
  interfaces: [ IEveSocketParameter ],
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "value", be.READWRITE | be.PERSIST ],
    [ be.METHOD, "Used", be.WRAP ],
    [ be.METHOD, "SetValueToDefault", be.WRAP ]
  ]
})
export class EveSocketParameterBool extends EveSocketParameterBindingBase
{

  /** m_value (bool) */

  @type.boolean
  value = false;

  /** m_defaults - one default captured per bound external parameter. */
  _defaults = [];

  /**
   * Discards the captured defaults along with the bindings, so nothing can be
   * restored afterwards.
   *
   * @implemented
   */

  ClearBindings()
  {
    this._defaults.length = 0;
    super.ClearBindings();
  }

  /**
   * Restores every binding's default and copies it out, then clears.
   *
   * @implemented
   */

  Reset()
  {
    for (let index = 0; index < this.bindings.length; index++)
    {
      this.value = this._defaults[index];
      this.bindings[index].CopyValue();
    }
    this.ClearBindings();
  }

  /**
   * Captures the external parameter's current value as a boolean default, using
   * false when the read throws; always succeeds, so a bind is never refused on
   * its account.
   */

  ExtractDefault(externalParameter)
  {
    let value = false;
    try
    {
      value = !!externalParameter.GetValue();
    }
    catch
    {
      value = false;
    }
    this._defaults.push(value);
    return true;
  }

  /**
   * Restores the first captured default, falling back to false when nothing was
   * captured.
   *
   * @implemented
   */
  SetValueToDefault()
  {
    this.value = this._defaults.length ? this._defaults[0] : false;
  }

}
