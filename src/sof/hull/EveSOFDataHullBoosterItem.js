import { exposure as be } from "#be";
import { IRoot } from "../../blue/blueexposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type, blue } from "#schema";
import { mat4 } from "#math/mat4";
import { vec4 } from "#math/vec4";

/** Defines a booster transform, functionality, trail, atlas, and light scale. */
@be.define({
  name: "EveSOFDataHullBoosterItem",
  inherit: [ IRoot ],
  // EveSOFData_Blue.cpp:739-747, in Carbon's order.
  members: [
    [ be.ATTR, "transform", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "functionality", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "hasTrail", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "atlasIndex0", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "atlasIndex1", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "lightScale", be.READWRITE | be.PERSIST ]
  ]
})
export class EveSOFDataHullBoosterItem extends IRoot
{

  /** m_transform (Matrix) [READWRITE, PERSIST] */

  @type.mat4
  transform = mat4.create();

  /** m_functionality (Vector4) [READWRITE, PERSIST] */

  @type.vec4
  functionality = vec4.fromValues(0, 1, 1, 1);

  /** m_hasTrail (bool) [READWRITE, PERSIST] */

  @type.boolean
  hasTrail = true;

  /** m_atlasIndex0 (uint32_t) [READWRITE, PERSIST] */

  @type.uint32
  atlasIndex0 = 0;

  /** m_atlasIndex1 (uint32_t) [READWRITE, PERSIST] */

  @type.uint32
  atlasIndex1 = 0;

  /** m_lightScale (float) [READWRITE, PERSIST] */

  @type.float32
  lightScale = 1;

}
