import { exposure as be } from "#be";
import { IRoot } from "../../blue/exposure/IRoot.js";
// Source: trinity/trinity/Sprite2d/Tr2Sprite2dLineTrace.h
// Promoted to hand-maintained source 2026-07-23 (Carbon-verified property shell; schema sprite2d/Tr2Sprite2dLineTraceVertex.json.).
import { type } from "#schema";
import { vec2 } from "#math/vec2";
import { vec4 } from "#math/vec4";

/**
 * Stores one editable Sprite2D line-trace point's position, color, and optional name
 * (Tr2Sprite2dLineTrace.h:15-28; defaults Tr2Sprite2dLineTrace.cpp:10-14; exposure Tr2Sprite2dLineTrace_Blue.cpp:399-421).
 */
@be.define({
  name: "Tr2Sprite2dLineTraceVertex",
  inherit: [ IRoot ],
  // Tr2Sprite2dLineTrace_Blue.cpp:401-416, in Carbon's order.
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "position", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "color", be.READWRITE | be.PERSIST ]
  ]
})

export class Tr2Sprite2dLineTraceVertex extends IRoot
{

  /** m_name (std::string) [READWRITE, PERSIST] */

  @type.string
  name = "";

  /** m_position (Vector2) [READWRITE, PERSIST] */

  @type.vec2
  position = vec2.create();

  /** m_color (Color) [READWRITE, PERSIST] */

  @type.color
  color = vec4.fromValues(1, 1, 1, 1);

}

// Native IRoot record exposes only its concrete interface.
