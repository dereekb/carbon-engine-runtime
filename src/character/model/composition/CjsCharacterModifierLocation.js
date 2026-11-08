import { meta, type } from "#schema";
import { CjsCharacterRecord } from "../CjsCharacterRecord.js";

/** Authored modifier location naming one category and variation. */
@meta.define("CjsCharacterModifierLocation")
@meta.exposureChainTo(CjsCharacterRecord)
export class CjsCharacterModifierLocation extends CjsCharacterRecord
{

    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)

    @type.string
    modifierKey = "";

    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)

    @type.string
    variationKey = "";

}
