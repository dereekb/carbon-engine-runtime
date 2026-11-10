import { meta, type } from "#schema";
import { CjsCharacterRecord } from "../CjsCharacterRecord.js";

// Discovery: src/character/discovery/animationoffsets.yaml
// Resource pattern: res:/graphics/character/unique/characterselect/*

/**
 * A source of named three-component animation offsets.
 * Storage defaults initialize empty records; they are not inferred authored defaults.
 */
@meta.define("CjsCharacterAnimationOffsets")
@meta.exposureChainTo(CjsCharacterRecord)
export class CjsCharacterAnimationOffsets extends CjsCharacterRecord
{

    /** Library identity for this unnamed root; not a key added to the original file. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.string
    name = "";

    /** Authored keys and vec3 Python tuples; JS number components preserve precision. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.map({ kind: "list", itemType: "float64" })
    value = new Map();

}
