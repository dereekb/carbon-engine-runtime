import { meta, type } from "#schema";
import { CjsCharacterRecord } from "../CjsCharacterRecord.js";

// Discovery: src/character/discovery/trif.yaml
// Resource pattern: res:/graphics/character/global/facesetup/*

/**
 * A source of named sculpt fields, retaining the authored Fields key.
 * Storage defaults initialize empty records; they are not inferred authored defaults.
 */
@meta.define("CjsCharacterFieldSet")
@meta.exposureChainTo(CjsCharacterRecord)
export class CjsCharacterFieldSet extends CjsCharacterRecord
{

    /** Authored field identifiers and records. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.map({ kind: "rootRef", className: "CjsCharacterField" })
    Fields = new Map();

}
