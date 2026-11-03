import { exposure as be } from "#be";
import { IRoot } from "../../../../blue/exposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObject/Attachments/Sets/EveSpriteSetItem.h
// Source: trinity/trinity/Eve/SpaceObject/Attachments/Sets/EveSpriteSetItem.cpp
// Source: trinity/trinity/Eve/SpaceObject/Attachments/Sets/EveSpriteSetItem_Blue.cpp
import { vec3 } from "#math/vec3";
import { box3 } from "#math/box3";
import { vec4 } from "#math/vec4";
import { type } from "#schema";

/**
 * One authored sprite: its bone attachment, position, blink timing, scale range,
 * falloff and normal and warp colours.
 */
@be.define({
  name: "EveSpriteSetItem",
  inherit: [ IRoot ],
  // EveSpriteSetItem_Blue.cpp:10-54, in Carbon's order.
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "position", be.READWRITE | be.NOTIFY | be.PERSIST ],
    [ be.ATTR, "blinkRate", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "blinkPhase", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "minScale", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "maxScale", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "falloff", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "color", be.READWRITE | be.NOTIFY | be.PERSIST ],
    [ be.ATTR, "warpColor", be.READWRITE | be.NOTIFY | be.PERSIST ],
    [ be.ATTR, "boneIndex", be.READWRITE | be.PERSIST ]
  ]
})
export class EveSpriteSetItem extends IRoot
{
  @type.string
  name = "";

  @type.float32
  blinkRate = 0.1;

  @type.float32
  blinkPhase = 0;

  @type.float32
  minScale = 1;

  @type.float32
  maxScale = 10;

  @type.float32
  falloff = 0;


  @type.vec3
  position = vec3.create();


  @type.color
  color = vec4.fromValues(1, 1, 1, 1);


  @type.color
  warpColor = vec4.fromValues(1, 1, 1, 1);

  @type.int32
  boneIndex = 0;

  /**
   * Carbon EveSpriteSetItem::GetBounds (cpp:35-38): Sphere(position, maxScale)
   * - the sprite at its largest blink scale. `out` is required; the item-set
   * bounds builder supplies its own scratch.
   *
   * @adapted Carbon returns Sphere by value; JavaScript follows the runtime sphere
   *   out-parameter convention.
   */

  GetBounds(out)
  {
    return box3.fromPositionRadius(out, this.position, this.maxScale);
  }

  /**
   * The parent bone this sprite rides.
   *
   * @implemented
   */

  GetBoneIndex()
  {
    return this.boneIndex;
  }
}
