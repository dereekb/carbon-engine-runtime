import { exposure as be } from "#be";
import { IRoot } from "../../../blue/blueexposure/IRoot.js";
// Source: trinity/trinity/EveSprite2dBracket.h
// Source: trinity/trinity/EveSprite2dBracket.cpp
import { vec2 } from "#math/vec2";
import { vec4 } from "#math/vec4";
import { type, blue } from "#schema";


/**
 * Screen-space bracket drawn from an atlas icon, carrying its own colour, 2D
 * translation and display flag.
 */
@be.define({
  name: "EveSprite2dBracket",
  inherit: [ IRoot ],
  // EveSprite2dBracket_Blue.cpp:10-31, in Carbon's order.
  members: [
    [ be.ATTR, "display", be.READWRITE ],
    [ be.ATTR, "translation", be.READWRITE ],
    [ be.ATTR, "icon", be.READWRITE ],
    [ be.ATTR, "color", be.READWRITE ]
  ]
})

export class EveSprite2dBracket extends IRoot
{
  @type.color
  color = vec4.fromValues(1, 1, 1, 1);

  @type.object.ref("Tr2AtlasTexture")
  icon = null;

  @type.boolean
  display = true;

  @type.vec2
  translation = vec2.create();

  /**
   * Copies the bracket translation into caller-provided storage.
   *
   * @adapted
   */

  GetTranslation(out)
  {
    return vec2.copy(out, this.translation);
  }

  /**
   * Replaces the bracket translation while preserving field identity.
   *
   * @adapted
   */

  SetTranslation(value)
  {
    vec2.copy(this.translation, value);
  }

  /**
   * Gets the authored atlas icon.
   *
   * @implemented
   */

  GetIcon()
  {
    return this.icon;
  }

  /**
   * Gets the mutable authored color container.
   *
   * @implemented
   */

  GetColor()
  {
    return this.color;
  }

  /**
   * Sets whether the bracket is displayed.
   *
   * @implemented
   */

  SetDisplay(display)
  {
    this.display = Boolean(display);
  }

  /**
   * Gets whether the bracket is displayed.
   *
   * @implemented
   */

  IsDisplay()
  {
    return this.display;
  }

}
