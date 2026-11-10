import { meta, type } from "#schema";
import { CjsBlueGraph } from "../../blue/formats/graph/CjsBlueGraph.js";
import { TnySpaceObjectIdentity } from "./TnySpaceObjectIdentity.js";

/**
 * What a ship is: a space object's identity plus the skin it wears, either a
 * CCP skin or a SKINR design, never both. Ours, read-only.
 */
@meta.define({ className: "TnyShipIdentity" })
@meta.exposureChainTo(TnySpaceObjectIdentity)
export class TnyShipIdentity extends TnySpaceObjectIdentity
{
    /** A CCP skin, or null. */
    @meta.mapAttribute(meta.READ)
    @type.object.ref("TnySkinIdentity")
    skin = null;

    /** A SKINR design, or null. */
    @meta.mapAttribute(meta.READ)
    @type.object.ref("TnySkinrIdentity")
    skinr = null;
}

CjsBlueGraph.define(TnyShipIdentity, "TnyShipIdentity");
