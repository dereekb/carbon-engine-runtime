// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
import { exposure as be } from "#be";
//   SOF_PARAM_DECLARE( EveSOFDataParameterVector2, ... ) - Carbon declares the six typed
//   parameters through one macro beside their base.
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue2.cpp:20-38
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.cpp:85-102
import { type } from "#schema";
import { vec2 } from "#math/vec2";
import { vec4 } from "#math/vec4";
import { EveSOFDataParameter } from "./EveSOFDataParameter.js";

/** Two-component shader parameter: zero-pads z and w. */
@be.define({
  name: "EveSOFDataParameterVector2",
  // EveSOFData_Blue2.cpp:36-36, in Carbon's order.
  interfaces: [ EveSOFDataParameter ],
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "value", be.READWRITE | be.PERSIST ]
  ]
})
export class EveSOFDataParameterVector2 extends EveSOFDataParameter
{
  /**
   * Owned two-component shader value; GetValue zero-pads z and w.
   * Native m_value (Vector2) replaces the base vector in authored values.
   * @type {Float32Array}
   */

  @type.vec2
  value = vec2.create();

  /**
   * Returns a new four-component vector with zero-filled z and w components.
   *
   * @implemented
   */

  GetValue()
  {
    return vec4.fromValues(this.value[0], this.value[1], 0, 0);
  }
}

