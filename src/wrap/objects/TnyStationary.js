import { EveStation2 } from "../../trinity/eve/spaceObject/EveStation2.js";
import { TnySpaceObject } from "./TnySpaceObject.js";

/** A station or structure (EveStation2). Ours, after ccpwgl's TnyStationary. */
export class TnyStationary extends TnySpaceObject
{
    static className = "TnyStationary";

    static wrappedClass = EveStation2;

    static wrappedName = "EveStation2";
}
