import { meta, type } from "#schema";
import { CjsCharacterRecord } from "../CjsCharacterRecord.js";

// Discovery: src/character/discovery/prs.yaml
// Discovery: src/character/discovery/scenes_prs.yaml
// Resource pattern: res:/graphics/character/*

/**
 * A recipe: the sex its first line names, then its ordered modifier records. The file is one list; the reader
 * (`CjsCharacterFactory.recipeConfiguration`) splits its leading string from its mappings.
 * Storage defaults initialize empty records; they are not inferred authored defaults.
 */
@meta.define("CjsCharacterRecipe")
@meta.exposureChainTo(CjsCharacterRecord)
export class CjsCharacterRecipe extends CjsCharacterRecord
{

    /** Library identity for this unnamed root; not a key added to the original file. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.string
    name = "";

    /**
     * The sex the file's first line names (`female`, `male`), or "" when it names none: 58 of the 63 recipes under
     * res:/graphics/character carry it (src/character/discovery/prs.yaml:527), all 317 scene recipes do
     * (scenes_prs.yaml:1049).
     */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.string
    sex = "";

    /** The file's modifier records, in file order. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.list("CjsCharacterRecipeModifier")
    modifiers = [];

}
