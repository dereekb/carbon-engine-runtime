import { meta, type } from "#schema";
import { CjsBlueGraph } from "../../blue/formats/graph/CjsBlueGraph.js";
import { CjsGraphRoot } from "../../global/model/graph/CjsGraphRoot.js";

/** A CCP skin a ship wears, read-only. Ours. Null where it is not known. */
@meta.define({ className: "TnySkinIdentity" })
export class TnySkinIdentity extends CjsGraphRoot
{
    /** The SDE skin ID. */
    @meta.mapAttribute(meta.READ)
    @type.int32
    skinID = null;

    /** The skin's name. */
    @meta.mapAttribute(meta.READ)
    @type.string
    name = null;

    /** The SOF material set it applies. */
    @meta.mapAttribute(meta.READ)
    @type.string
    material = null;
}

CjsBlueGraph.define(TnySkinIdentity, "TnySkinIdentity");
