import { meta, type } from "#schema";
import { CjsBlueGraph } from "../../blue/formats/graph/CjsBlueGraph.js";
import { CjsGraphRoot } from "../../global/model/graph/CjsGraphRoot.js";

/**
 * What a space object is, filled in by the library and read-only to a UI:
 * separate from the user's writable `name`. Ours. Null where it is not known.
 */
@meta.define({ className: "TnySpaceObjectIdentity" })
export class TnySpaceObjectIdentity extends CjsGraphRoot
{
    /** The DNA the object was built from. */
    @meta.mapAttribute(meta.READ)
    @type.string
    dna = null;

    /** The SDE type ID. */
    @meta.mapAttribute(meta.READ)
    @type.int32
    typeID = null;

    /** The SDE type name. */
    @meta.mapAttribute(meta.READ)
    @type.string
    typeName = null;

    /** The SDE graphic ID. */
    @meta.mapAttribute(meta.READ)
    @type.int32
    graphicID = null;

    /** The SOF hull. */
    @meta.mapAttribute(meta.READ)
    @type.string
    hull = null;

    /** The SOF faction. */
    @meta.mapAttribute(meta.READ)
    @type.string
    faction = null;

    /** The SOF race. */
    @meta.mapAttribute(meta.READ)
    @type.string
    race = null;
}

CjsBlueGraph.define(TnySpaceObjectIdentity, "TnySpaceObjectIdentity");
