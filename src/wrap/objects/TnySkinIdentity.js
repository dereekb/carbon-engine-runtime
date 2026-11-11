import { meta, type } from "#schema";
import { CjsBlueGraph } from "../../blue/formats/graph/CjsBlueGraph.js";
import { CjsGraphRoot } from "../../global/model/graph/CjsGraphRoot.js";

/**
 * A CCP skin a ship wears, read-only. Ours. Null where it is not known.
 * @cjs
 */
@meta.define({ className: "TnySkinIdentity" })
@meta.exposureChainTo(CjsGraphRoot)
export class TnySkinIdentity extends CjsGraphRoot
{

    /**
     * The SDE skin ID.
     * @type {number|null}
     * @cjs
     */
    @meta.mapAttribute(meta.READ)
    @type.int32
    skinID = null;

    /**
     * The skin's name.
     * @type {string|null}
     * @cjs
     */
    @meta.mapAttribute(meta.READ)
    @type.string
    name = null;

    /**
     * The SOF material set it applies.
     * @type {string|null}
     * @cjs
     */
    @meta.mapAttribute(meta.READ)
    @type.string
    material = null;

    /**
     * Stable identity for diagnostics and registration.
     * @type {string}
     * @cjs
     */
    static className = "TnySkinIdentity";

}

CjsBlueGraph.define(TnySkinIdentity, "TnySkinIdentity");
