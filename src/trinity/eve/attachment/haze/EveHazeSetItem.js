import { exposure as be } from "#be";
import { IRoot } from "../../../../blue/blueexposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObject/Attachments/Sets/EveHazeSetItem.h
// Source: trinity/trinity/Eve/SpaceObject/Attachments/Sets/EveHazeSetItem.cpp
// Source: trinity/trinity/Eve/SpaceObject/Attachments/Sets/EveHazeSetItem_Blue.cpp
import { box3 } from "#math/box3";
import { mat4 } from "#math/mat4";
import { quat } from "#math/quat";
import { vec3 } from "#math/vec3";
import { vec4 } from "#math/vec4";
import { type, blue } from "#schema";

/**
 * One authored haze volume: its bone attachment, placement, colour and the
 * four-component haze shaping data.
 */
@be.define({
  name: "EveHazeSetItem",
  inherit: [ IRoot ],
  // EveHazeSetItem_Blue.cpp:10-20, in Carbon's order.
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "position", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "scaling", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "rotation", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "color", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "hazeData", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "boneIndex", be.READWRITE | be.PERSIST ]
  ]
})
export class EveHazeSetItem extends IRoot
{
  @type.color
  color = vec4.fromValues(1, 1, 1, 1);

  @type.quat
  rotation = quat.create();

  @type.vec3
  scaling = vec3.fromValues(1, 1, 1);

  @type.string
  name = "";

  @type.int32
  boneIndex = 0;

  @type.vec3
  position = vec3.create();

  @type.vec4
  hazeData = vec4.fromValues(4, 0.2, 2, 0);

  /**
   * Fills the caller-owned out box with the haze's authored source box - which
   * reaches to z 5 rather than 0.5, because a haze extends well beyond its
   * placement - transformed by its rotation, position and scaling.
   *
   * @adapted Carbon returns AxisAlignedBox by value; JavaScript fills a caller-supplied
   *   box3.
   */

  GetBounds(out)
  {
    // Carbon (row-vector): TransformationMatrix(scaling, rotation, position).
    const transform = mat4.fromRotationTranslationScale(
      EveHazeSetItem._transform,
      this.rotation,
      this.position,
      this.scaling
    );
    return box3.transformMat4(out, EveHazeSetItem._bounds, transform);
  }

  /**
   * The parent bone this haze volume rides.
   *
   * @implemented
   */

  GetBoneIndex()
  {
    return this.boneIndex;
  }

  static _bounds = box3.fromValues(-0.5, -0.5, -0.5, 0.5, 0.5, 5);

  static _transform = mat4.create();
}
