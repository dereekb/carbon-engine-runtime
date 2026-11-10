import { meta, type } from "#schema";
import { CjsCharacterRecord } from "../CjsCharacterRecord.js";

// Discovery: src/character/discovery/basename.yaml
// Resource pattern: res:/graphics/character/global/paperdolllibrary/posts/*

/**
 * A scalar post base-name source. The original value is not split into a list.
 * Storage defaults initialize empty records; they are not inferred authored defaults.
 */
@meta.define("CjsCharacterPostBaseNames")
@meta.exposureChainTo(CjsCharacterRecord)
export class CjsCharacterPostBaseNames extends CjsCharacterRecord
{

    /** Library identity for this unnamed root; not a key added to the original file. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.string
    name = "";

    /** Complete authored scalar string. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.string
    value = "";

}
