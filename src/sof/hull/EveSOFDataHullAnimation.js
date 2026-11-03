import { exposure as be } from "#be";
import { IRoot } from "../../blue/blueexposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type } from "#schema";
import { quat } from "#math/quat";
import { vec3 } from "#math/vec3";

/** Identifies a hull animation and records its rotation, translation, timing, and rate endpoints. */
@be.define({
  name: "EveSOFDataHullAnimation",
  inherit: [ IRoot ],
  // EveSOFData_Blue.cpp:874-891, in Carbon's order.
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "startRotationValue", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "endRotationValue", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "startRotationTime", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "endRotationTime", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "startTranslationValue", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "endTranslationValue", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "startTranslationTime", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "endTranslationTime", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "id", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "startRate", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "endRate", be.READWRITE | be.PERSIST ]
  ]
})
export class EveSOFDataHullAnimation extends IRoot
{

  /** m_name (std::string) [READWRITE, PERSIST] */

  @type.string
  name = "";

  /** m_startRotationValue (Vector4) [READWRITE, PERSIST] */

  @type.vec4
  startRotationValue = quat.create();

  /** m_endRotationValue (Vector4) [READWRITE, PERSIST] */

  @type.vec4
  endRotationValue = quat.create();

  /** m_startRotationTime (float) [READWRITE, PERSIST] */

  @type.float32
  startRotationTime = -1;

  /** m_endRotationTime (float) [READWRITE, PERSIST] */

  @type.float32
  endRotationTime = -1;

  /** m_startTranslationValue (Vector3) [READWRITE, PERSIST] */

  @type.vec3
  startTranslationValue = vec3.create();

  /** m_endTranslationValue (Vector3) [READWRITE, PERSIST] */

  @type.vec3
  endTranslationValue = vec3.create();

  /** m_startTranslationTime (float) [READWRITE, PERSIST] */

  @type.float32
  startTranslationTime = -1;

  /** m_endTranslationTime (float) [READWRITE, PERSIST] */

  @type.float32
  endTranslationTime = -1;

  /** m_id (int32_t) [READWRITE, PERSIST] */

  @type.int32
  id = -1;

  /** m_startRate (float) [READWRITE, PERSIST] */

  @type.float32
  startRate = -1;

  /** m_endRate (float) [READWRITE, PERSIST] */

  @type.float32
  endRate = -1;

}
