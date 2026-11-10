import { meta, type } from "#schema";
import { CjsCharacterRecord } from "../CjsCharacterRecord.js";

/** Character library value record; no resource decoding or character construction. */
@meta.define("CjsCharacterNamedValue")
@meta.exposureChainTo(CjsCharacterRecord)
export class CjsCharacterNamedValue extends CjsCharacterRecord
{

    /** Lookup name. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.string
    name = "";

    /** Named primitive value or opaque resource path. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.unknown
    value = null;

}
