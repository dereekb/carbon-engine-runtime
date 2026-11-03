// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
import { exposure as be } from "#be";
//   SOF_PARAM_DECLARE( EveSOFDataParameterInt, ... ) - Carbon declares the six typed
//   parameters through one macro beside their base.
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue2.cpp:20-38
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.cpp:85-102
import { type } from "#schema";
import { vec4 } from "#math/vec4";
import { EveSOFDataParameter } from "./EveSOFDataParameter.js";

/** Integer shader parameter: broadcasts the value to all four components. */
@be.define({
  name: "EveSOFDataParameterInt",
  // EveSOFData_Blue2.cpp:34-34, in Carbon's order.
  interfaces: [ EveSOFDataParameter ],
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "value", be.READWRITE | be.PERSIST ]
  ]
})
export class EveSOFDataParameterInt extends EveSOFDataParameter
{
  /**
   * Authored signed integer shader value; GetValue broadcasts its float conversion.
   * Native m_value (int32_t) replaces the base vector in authored values.
   * @type {number}
   */

  @type.int32
  value = 0;

  /**
   * Returns a new vector containing the numeric value in all four components.
   *
   * @implemented
   */

  GetValue()
  {
    const scalar = Number(this.value);
    return vec4.fromValues(scalar, scalar, scalar, scalar);
  }
}

