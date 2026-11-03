import { exposure as be } from "#be";
import { IRoot } from "../../../../blue/exposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObject/Attachments/Sets/EveSpotlightSetItem.h
// Source: trinity/trinity/Eve/SpaceObject/Attachments/Sets/EveSpotlightSetItem.cpp
// Source: trinity/trinity/Eve/SpaceObject/Attachments/Sets/EveSpotlightSetItem_Blue.cpp
import { box3 } from "#math/box3";
import { mat4 } from "#math/mat4";
import { vec3 } from "#math/vec3";
import { vec4 } from "#math/vec4";
import { type } from "#schema";

/**
 * One authored spotlight: its bone attachment, placement matrix, the separate
 * cone, flare and sprite colours drawn for it, and whether booster gain
 * modulates it.
 */
@be.define({
  name: "EveSpotlightSetItem",
  inherit: [ IRoot ],
  // EveSpotlightSetItem_Blue.cpp:10-24, in Carbon's order.
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "transform", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "coneColor", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "spriteColor", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "flareColor", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "boneIndex", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "boosterGainInfluence", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "spriteScale", be.READWRITE | be.PERSIST ]
  ]
})
export class EveSpotlightSetItem extends IRoot
{
  @type.string
  name = "";

  @type.int32
  boneIndex = 0;

  @type.color
  coneColor = vec4.fromValues(1, 1, 1, 1);

  @type.color
  flareColor = vec4.fromValues(1, 1, 1, 1);

  @type.color
  spriteColor = vec4.fromValues(1, 1, 1, 1);

  @type.mat4
  transform = mat4.create();

  @type.vec3
  spriteScale = vec3.fromValues(1, 1, 1);

  @type.boolean
  boosterGainInfluence = false;

  /**
   * Fills the caller-owned out box with the spotlight's unit box transformed by
   * its authored placement matrix.
   *
   * @adapted Carbon returns AxisAlignedBox by value; JavaScript fills a caller-supplied
   *   box3.
   */

  GetBounds(out)
  {
    return box3.transformMat4(out, EveSpotlightSetItem._bounds, this.transform);
  }

  /**
   * The parent bone this spotlight rides.
   *
   * @implemented
   */

  GetBoneIndex()
  {
    return this.boneIndex;
  }

  static _bounds = box3.fromValues(-0.5, -0.5, -0.5, 0.5, 0.5, 0.5);
}
