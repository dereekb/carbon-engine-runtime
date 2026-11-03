import { exposure as be } from "#be";
import { IRoot } from "../../../blue/exposure/IRoot.js";
// Source: trinity/trinity/Shader/Parameter/TriFloatArrayParameter.h
// Source: trinity/trinity/Shader/Parameter/TriFloatArrayParameter.cpp
import { vec4 } from "#math/vec4";
import { type } from "#schema";


/** One vec4 row of a TriFloatArrayParameter's value list. */
@be.define({
  name: "TriVector4",
  inherit: [ IRoot ],
  // TriFloatArrayParameter_Blue.cpp:9-12, in Carbon's order.
  members: [
    [ be.ATTR, "data", be.READWRITE | be.PERSIST ]
  ]
})

export class TriVector4 extends IRoot
{
  @type.vec4
  data = vec4.create();
}
