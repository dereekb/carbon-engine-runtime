import { meta, type } from "#schema";
import { CjsCharacterRecord } from "../CjsCharacterRecord.js";

// Discovery: src/character/discovery/scenes_curve_cache_list.yaml
// Resource pattern: res:/animation_gstate/scenes/*

/**
 * An ordered source list of curve-set references.
 * Storage defaults initialize empty records; they are not inferred authored defaults.
 */
@meta.define("CjsCharacterCurveCacheList")
@meta.exposureChainTo(CjsCharacterRecord)
export class CjsCharacterCurveCacheList extends CjsCharacterRecord
{

    /** Library identity for this unnamed root; not a key added to the original file. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.string
    name = "";

    /** Authored curve-set paths; no .red/.black rewrite is applied. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.list({ kind: "path", accepts: ["TriCurveSet"] })
    value = [];

}
