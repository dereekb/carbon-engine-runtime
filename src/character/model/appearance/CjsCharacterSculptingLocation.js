import { meta, type } from "#schema";
import { CjsCharacterRecord } from "../CjsCharacterRecord.js";

/** Authored sculpt-control location naming its weight category and prefix. */
@meta.define("CjsCharacterSculptingLocation")
@meta.exposureChainTo(CjsCharacterRecord)
export class CjsCharacterSculptingLocation extends CjsCharacterRecord
{

    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.string
    weightKeyCategory = "";

    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.string
    weightKeyPrefix = "";

}
