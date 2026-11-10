import { meta, type } from "#schema";
import { CjsCharacterRecord } from "../CjsCharacterRecord.js";

/** Character library value record; no resource decoding or character construction. */
@meta.define("CjsCharacterRig")
@meta.exposureChainTo(CjsCharacterRecord)
export class CjsCharacterRig extends CjsCharacterRecord
{

    /** Lookup name. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.string
    name = "";

    /** Opaque rig path. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.path(".gr2")
    resFilePath = "";

}
