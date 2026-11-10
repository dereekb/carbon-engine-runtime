import { meta, type } from "#schema";
import { CjsCharacterRecord } from "../CjsCharacterRecord.js";

/** Character library value record; no resource decoding or character construction. */
@meta.define("CjsCharacterClip")
@meta.exposureChainTo(CjsCharacterRecord)
export class CjsCharacterClip extends CjsCharacterRecord
{

    /** Lookup name. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.string
    name = "";

    /** Opaque animation clip path. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.path(".gr2")
    resFilePath = "";

}
