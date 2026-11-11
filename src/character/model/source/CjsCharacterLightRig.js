import { meta, type } from "#schema";
import { CjsCharacterRecord } from "../CjsCharacterRecord.js";

// Resource pattern: res:/graphics/character/global/paperdolllibrary/lights/*.yaml, res:/animation_gstate/scenes/**/lights.yaml

/**
 * A light rig: the lights one rig file holds. The files save them inside a `Tr2InteriorScene` that holds nothing else;
 * the reader keeps only its `lights` and makes no scene, so the library stays free of live scenes and a user adds the
 * lights to a scene of their own.
 */
@meta.define("CjsCharacterLightRig")
@meta.exposureChainTo(CjsCharacterRecord)
export class CjsCharacterLightRig extends CjsCharacterRecord
{

    /** The rig's lights, as the file's scene held them. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.list("Tr2InteriorLightSource")
    lights = [];

}
