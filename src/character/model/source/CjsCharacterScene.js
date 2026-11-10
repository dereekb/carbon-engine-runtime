import { meta, type } from "#schema";
import { CjsCharacterRecord } from "../CjsCharacterRecord.js";

// Discovery: src/character/discovery/scenes_scene.yaml
// Resource pattern: res:/animation_gstate/scenes/*

/**
 * A scene document containing source character records, without building characters.
 * Storage defaults initialize empty records; they are not inferred authored defaults.
 */
@meta.define("CjsCharacterScene")
@meta.exposureChainTo(CjsCharacterRecord)
export class CjsCharacterScene extends CjsCharacterRecord
{

    /** Ordered authored character records. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.list("CjsCharacterSceneCharacter")
    characters = [];

}
