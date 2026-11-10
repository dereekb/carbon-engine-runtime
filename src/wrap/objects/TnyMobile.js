import { EveMobile } from "../../trinity/eve/spaceObject/EveMobile.js";
import { TnySpaceObject } from "./TnySpaceObject.js";
import { TnySlot } from "./TnySlot.js";

/** A space object that moves (EveMobile). Ours, after ccpwgl's TnyMobile. */
export class TnyMobile extends TnySpaceObject
{
    static className = "TnyMobile";

    static wrappedClass = EveMobile;

    static wrappedName = "EveMobile";

    /** The weapon slots, discovered from the hull's locators on first use. */
    _slots = null;

    /**
     * The weapon slots this hull's locators define (TnySlot), by family and number.
     *
     * @returns {TnySlot[]} The slots.
     */
    GetSlots()
    {
        return this._slots ??= TnySlot.discover(this);
    }
}
