import { meta, type } from "#schema";
import { vec4 } from "#math/vec4";

// Discovery: src/character/discovery/prs.yaml
// Additional discovery: scenes_prs.yaml
// Resource pattern: res:/graphics/character/*

/**
 * One modifier in a recipe: a part or shape, its weight, and the material values the game stored resolved for it
 * (`colorVariation` only names the palette they came from). The reader translates the file's keys and its `colors`
 * text (`CjsCharacterFactory.recipeConfiguration.sourceLists`); the field names follow the former catalog record's
 * (CjsCharacterRecipeEntry) and the palette's (`CjsCharacterColorVariation`).
 * Storage defaults initialize empty records; they are not inferred authored defaults.
 */
@meta.define("CjsCharacterRecipeModifier")
export class CjsCharacterRecipeModifier
{

    /** The modifier's category, as written. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.string
    category = "";

    /** The part or shape the modifier names, below the paper doll root, as written; 97 entries have none. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.string
    path = "";

    /** A morph strength for shapes, a layer amount for makeup. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.float64
    weight = 0;

    /** The tuck flag (true in every shipped recipe that writes it). */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.boolean
    tuck = false;

    /** The part's variation folder (`v0`, `v1`...), or "". */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.string
    variation = "";

    /** The palette the colours came from, by its file stem (the file's `colorvariation`), or "". */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.string
    colorVariation = "";

    /**
     * The modifier's own colours, one per colour area (the file's `colors` text, three tuples); empty when it states
     * none or names a pattern.
     */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.list("color")
    colors = [];

    /** Colour area 1's specular colour (the file's `specularcolors[0]`); neutral grey when it has none. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.color
    specularColor1 = vec4.fromValues(.5, .5, .5, 1);

    /** Colour area 2's specular colour (`specularcolors[1]`); neutral grey when it has none. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.color
    specularColor2 = vec4.fromValues(.5, .5, .5, 1);

    /** Colour area 3's specular colour (`specularcolors[2]`); neutral grey when it has none. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.color
    specularColor3 = vec4.fromValues(.5, .5, .5, 1);

    /** The pattern the modifier names, as written, or "". With one, the `colors` text holds the pattern fields below. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.string
    pattern = "";

    /** The pattern colour the pattern texture's R channel selects. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.color
    patternColor1 = vec4.create();

    /** The pattern colour the pattern texture's G channel selects. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.color
    patternColor2 = vec4.create();

    /** The pattern colour the pattern texture's B channel selects. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.color
    patternColor3 = vec4.create();

    /** Colour area 2's colour under the pattern. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.color
    patternAreaColor2 = vec4.create();

    /** Colour area 3's colour under the pattern. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.color
    patternAreaColor3 = vec4.create();

    /** The pattern's placement: offset x, y, then repeat x, y. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.vec4
    patternTransform = vec4.create();

    /** The pattern's rotation in degrees. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.float64
    patternRotation = 0;

    /** A full inline projected decal (the file's `decaldata`), or null. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.object.ref("CjsProjectedDecal")
    decalData = null;

    /** The decal's weight (the file's `decalweight`). */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.float64
    decalWeight = 0;

}
