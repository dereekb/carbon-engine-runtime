import { EveShip2 } from "../../trinity/eve/spaceObject/EveShip2.js";
import { TnyMobile } from "./TnyMobile.js";

/** A ship (EveShip2). Ours, after ccpwgl's TnyShip. `TnyShip.fetch({ dna })` requires a ship. */
export class TnyShip extends TnyMobile
{
    static className = "TnyShip";

    static wrappedClass = EveShip2;

    static wrappedName = "EveShip2";
}
