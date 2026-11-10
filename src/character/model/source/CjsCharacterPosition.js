import { meta, type } from "#schema";
import { CjsCharacterRecord } from "../CjsCharacterRecord.js";

// Discovery: src/character/discovery/positions.yaml
// Additional discovery: scenes_position.yaml
// Resource pattern: res:/graphics/character/global/paperdolllibrary/positions/*

/**
 * Placement with authored translation and four-component rotation.
 * Storage defaults initialize empty records; they are not inferred authored defaults.
 */
@meta.define("CjsCharacterPosition")
@meta.exposureChainTo(CjsCharacterRecord)
export class CjsCharacterPosition extends CjsCharacterRecord
{

    /** Authored four-component rotation tuple. Plain number storage avoids float32 rounding; source length is 4. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.list("float64")
    rotation = [0, 0, 0, 0];

    /** Authored 3-component numeric tuple. Plain number storage avoids float32 rounding; source length is 3. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.list("float64")
    translation = [0, 0, 0];

}
