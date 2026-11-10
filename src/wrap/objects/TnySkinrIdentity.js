import { meta, type } from "#schema";
import { CjsBlueGraph } from "../../blue/formats/graph/CjsBlueGraph.js";
import { CjsGraphRoot } from "../../global/model/graph/CjsGraphRoot.js";

/**
 * A SKINR design a ship wears, read-only. Ours. Its look (pattern and mesh
 * colours) is DNA and values, not identity. Null where it is not known.
 */
@meta.define({ className: "TnySkinrIdentity" })
export class TnySkinrIdentity extends CjsGraphRoot
{
    /** The design's name. */
    @meta.mapAttribute(meta.READ)
    @type.string
    name = null;

    /** Who designed it. */
    @meta.mapAttribute(meta.READ)
    @type.string
    author = null;

    /** The design line it belongs to. */
    @meta.mapAttribute(meta.READ)
    @type.string
    line = null;

    /** Who sells it. */
    @meta.mapAttribute(meta.READ)
    @type.string
    seller = null;
}

CjsBlueGraph.define(TnySkinrIdentity, "TnySkinrIdentity");
