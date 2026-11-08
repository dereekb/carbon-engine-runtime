import { meta, type } from "#schema";
import { vec4 } from "#math/vec4";

// Discovery: src/character/discovery/prs.yaml
// Additional discovery: scenes_prs.yaml
// Resource pattern: res:/graphics/character/*

/**
 * One authored modifier in a recipe. Optional presence is retained by the reader/writer.
 * Storage defaults initialize empty records; they are not inferred authored defaults.
 */
@meta.define("CjsCharacterRecipeModifier")
export class CjsCharacterRecipeModifier
{

    /** Authored string, retained without normalization of spelling. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.string
    category = "";

    /** Authored string; unlike a colour variation this field is not a colour array. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.string
    colors = "";

    /** Authored part or modifier reference; retained without resolving it to an object. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.string
    path = "";

    /** Optional authored tuck flag. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.boolean
    tuck = false;

    /** Authored numeric value, retained at JavaScript number precision. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.float64
    weight = 0;

    /** Authored local colour-variation name. Input null normalizes to an empty string. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.path(".color")
    colorvariation = "";

    /** Colour area 1's specular colour (the recipe's `specularcolors[0]`); neutral grey when it has none. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.color
    specularColor1 = vec4.fromValues(.5, .5, .5, 1);

    /** Colour area 2's specular colour (the recipe's `specularcolors[1]`); neutral grey when it has none. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.color
    specularColor2 = vec4.fromValues(.5, .5, .5, 1);

    /** Colour area 3's specular colour (the recipe's `specularcolors[2]`); neutral grey when it has none. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.color
    specularColor3 = vec4.fromValues(.5, .5, .5, 1);

    /** Authored variation name. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.string
    variation = "";

    /** Authored string, retained without normalization of spelling. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.string
    pattern = "";

    /** Optional inline tagged decal record, or null. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.object.ref("CjsProjectedDecal")
    decaldata = null;

    /** Optional authored decal weight. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.float64
    decalweight = 0;

    /**
     * The three area colours `colors` authors, as written: `'[(r, g, b, a), (r, g, b, a), (r, g, b, a)]'`
     * (src/character/discovery/prs.yaml). Null when the entry authors none.
     * @cjs
     * @returns {?Float32Array[]} Three RGBA colours.
     * @throws {Error} For a `colors` string that is not three four-number tuples.
     */
    GetColors()
    {
        if (this.colors === "") return null;
        const tuples = [ ...this.colors.matchAll(/\(([^()]*)\)/gu) ].map(match => match[1].split(",").map(Number));
        if (tuples.length !== 3 || tuples.some(tuple => tuple.length !== 4 || !tuple.every(Number.isFinite)))
            throw new Error("Unreadable recipe colours: " + this.colors);
        return tuples.map(tuple => Float32Array.from(tuple));
    }

}
