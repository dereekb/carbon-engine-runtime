import { meta, type } from "#schema";
import { CjsBlueGraph } from "../../blue/formats/graph/CjsBlueGraph.js";
import { EveMobile } from "../../trinity/eve/spaceObject/EveMobile.js";
import { TnySpaceObject } from "./TnySpaceObject.js";
import { TnySlot } from "./TnySlot.js";

/**
 * A space object that moves (EveMobile): adds its weapon slots. Ours, after
 * ccpwgl's TnyMobile. Slots are hull facts, found once from its locators.
 */
@meta.define({ className: "TnyMobile" })
@meta.exposureChainTo(TnySpaceObject)
export class TnyMobile extends TnySpaceObject
{
    static wrappedClass = EveMobile;

    /** The weapon slots (TnySlot) the hull's locators define; null when it has none. */
    @meta.mapAttribute(meta.READ)
    @type.list("TnySlot")
    slots = null;

    /** Finds the slots once, then the rest. */
    _Discover(dna)
    {
        super._Discover(dna);
        if (this.slots === null)
        {
            const slots = TnySlot.discover(this);
            this.slots = slots.length ? slots : null;
        }
    }

    /** Adds "weapons" when the hull has slots. */
    _Interfaces()
    {
        return this.slots ? [ ...super._Interfaces(), "weapons" ] : super._Interfaces();
    }

    /** Detaches the slots too. */
    Destruct()
    {
        for (const slot of this.slots ?? []) slot.Destruct();
        super.Destruct();
    }
}

CjsBlueGraph.define(TnyMobile, "TnyMobile");
