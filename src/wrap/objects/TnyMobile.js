import { EveMobile } from "../../trinity/eve/spaceObject/EveMobile.js";
import { TnySpaceObject } from "./TnySpaceObject.js";

/** A space object that moves (EveMobile). Ours, after ccpwgl's TnyMobile. */
export class TnyMobile extends TnySpaceObject
{
    static className = "TnyMobile";

    static wrappedClass = EveMobile;

    static wrappedName = "EveMobile";
}
