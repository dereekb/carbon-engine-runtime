import { exposure as be } from "#be";
// Source: trinity/trinity/Eve/SpaceObject/Children/SocketParameters/EveSocketParameter.h
// Hand-authored following the eve/socket generated pattern.
import { IEveSocketParameter } from "./IEveSocketParameter.js";
import { EveSocketParameterString } from "./EveSocketParameterString.js";

/**
 * Specializes the string socket parameter for authored file paths while
 * retaining the same binding and restoration behavior. Carbon derives it from
 * EveSocketParameterString without adding members; only the editor widget
 * differs.
 */
@be.define({
  name: "EveSocketParameterFilePath",
  // EveSocketParameter_Blue.cpp:41-41, in Carbon's order.
  interfaces: [ IEveSocketParameter ],
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "value", be.READWRITE | be.PERSIST ],
    [ be.METHOD, "Used", be.WRAP ],
    [ be.METHOD, "SetValueToDefault", be.WRAP ]
  ]
})
export class EveSocketParameterFilePath extends EveSocketParameterString
{
}
