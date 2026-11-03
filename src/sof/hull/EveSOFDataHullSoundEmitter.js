import { exposure as be } from "#be";
import { IRoot } from "../../blue/exposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type } from "#schema";
import { quat } from "#math/quat";
import { vec3 } from "#math/vec3";

/** Defines a named sound-emitter event prefix, position, rotation, and attenuation settings. */
@be.define({
  name: "EveSOFDataHullSoundEmitter",
  inherit: [ IRoot ],
  // EveSOFData_Blue.cpp:918-925, in Carbon's order.
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "prefix", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "position", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "rotation", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "attenuationScalingFactor", be.READWRITE | be.PERSIST ]
  ]
})
export class EveSOFDataHullSoundEmitter extends IRoot
{

  /** m_name (std::string) [READWRITE, PERSIST] */

  @type.string
  name = "";

  /** m_prefix (std::wstring) [READWRITE, PERSIST]; JS stores both string widths as strings. */

  @type.wstring
  prefix = "";

  /** m_position (Vector3) [READWRITE, PERSIST] */

  @type.vec3
  position = vec3.create();

  /** m_rotation (Quaternion) [READWRITE, PERSIST] */

  @type.quat
  rotation = quat.create();

  /** m_attenuationScalingFactor (float) [READWRITE, PERSIST] */

  @type.float32
  attenuationScalingFactor = 1;

}
