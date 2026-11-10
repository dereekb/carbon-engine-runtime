import { meta, type } from "#schema";
import { CjsCharacterRecord } from "../CjsCharacterRecord.js";

/** Character library value record; no resource decoding or character construction. */
@meta.define("CjsCharacterGState")
@meta.exposureChainTo(CjsCharacterRecord)
export class CjsCharacterGState extends CjsCharacterRecord
{

    /** Lookup name. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.string
    name = "";

    /** Opaque animation state path. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.path(".gsf")
    resFilePath = "";

}
