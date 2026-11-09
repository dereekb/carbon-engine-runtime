import { meta, type } from "#schema";

// Discovery: src/character/discovery/prs.yaml
// Discovery: src/character/discovery/scenes_prs.yaml
// Resource pattern: res:/graphics/character/*

/**
 * A recipe sequence retaining its leading sex string when present and ordered modifier records.
 * Storage defaults initialize empty records; they are not inferred authored defaults.
 */
@meta.define("CjsCharacterRecipe")
export class CjsCharacterRecipe
{

    /** Library identity for this unnamed root; not a key added to the original file. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.string
    name = "";

    /**
     * Mixed source sequence: optional leading string and CjsCharacterRecipeModifier records. The reader
     * supplies record instances; the writer retains source layout.
     */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.list("unknown")
    value = [];

    /**
     * The ordered modifier records, without the leading sex string. The string is optional: 58 of the 63 recipes
     * under res:/graphics/character carry it (src/character/discovery/prs.yaml:527), all 317 scene recipes do
     * (scenes_prs.yaml:1049).
     * @cjs
     * @returns {Array<import("./CjsCharacterRecipeModifier.js").CjsCharacterRecipeModifier>}
     */
    GetModifiers()
    {
        return typeof this.value[0] === "string" ? this.value.slice(1) : this.value;
    }

    /**
     * The sex the recipe names on its first line (`female`, `male`), or "" for a recipe that names none (5 of 63 shipped
     * character recipes).
     * @cjs
     * @returns {string}
     */
    GetSex()
    {
        return typeof this.value[0] === "string" ? this.value[0] : "";
    }

}
