import { blue } from "#blue";
import { CjsPaperDollCompositor } from "../compositor/CjsPaperDollCompositor.js";
import { CjsPaperDollDefinition } from "../CjsPaperDollDefinition.js";
import { CjsPaperDollTextureRoles } from "./CjsPaperDollTextureRoles.js";

/**
 * The layer source of a map-decal part (aging, scarring): each option is a folder of maps, each drawn over the
 * composition's output its role feeds (`CjsPaperDollTextureRoles.lookup`: region, property, operation). The roles come
 * from the files the folder actually holds.
 *
 * An option's id is the folder its `types/` folder sits in. Options are listed from the file index; an option's
 * type and maps are read the first time it is applied (`CjsPaperDollComponent.ResolveOption`).
 *
 * Ours (no Carbon counterpart): Carbon ships no paper doll; the client's is Python. Moved from Graphene's
 * `surfaceDetails.js` (character-structure-and-plugins.md R5); the name is a working name.
 */
export class CjsPaperDollMapDecalSource
{

    static className = "CjsPaperDollMapDecalSource";

    /** The definition part this source serves. */
    name = "";

    /** The compositor its layers are made with. @type {CjsPaperDollCompositor} */
    _compositor = null;

    /** The build served: its waits and its content root. */
    _build = null;

    /** Each option's `.type` path, by id. @type {Map<string, string>} */
    _definitions = new Map();

    /** Each prepared option: its id, type path and per-region, per-channel layer. @type {Map<string, object>} */
    _options = new Map();

    /** The output properties its pass composes (`NormalMap`, `SpecularMap`). @type {string[]} */
    _properties = [];

    /** The part folder's files. @type {string[]} */
    _files = [];

    /**
     * @param {CjsPaperDollCompositor} compositor The compositor its layers are made with.
     * @param {{ Ready: function(Promise<*>): Promise<*>, content: { root: string } }} build The build served.
     * @param {string} name The definition part.
     * @param {string[]} properties The output properties its pass composes.
     */
    constructor(compositor, build, name, properties)
    {
        this._compositor = compositor;
        this._build = build;
        this.name = name;
        this._properties = properties;
    }

    /**
     * Lists the part's options from its folder and configures the definition's component with them: the option the
     * build's recipe sets for the part's category, on; with no recipe entry, the first option, off. Loading a recipe
     * applies everything it sets (operator, 2026-11-08); a character built without one starts with the part off.
     * The recipe's weight is not applied: the layers draw at full strength, and the shipped recipes set 1.0.
     * @param {import("../CjsPaperDollDefinition.js").CjsPaperDollDefinition} definition The paper doll definition.
     * @returns {Promise<void>}
     */
    async Configure(definition)
    {
        const build = this._build, component = definition[this.name], category = component.constructor.category;
        const files = CjsPaperDollDefinition.listFiles(build.content.root + category);
        this._files = files;
        this._definitions = new Map(files.filter(path => path.endsWith(".type"))
            .map(path => [ path.slice(0, path.indexOf("/types/")).split("/").at(-1), path ]));
        const recipe = build.content.recipe ? (await build.Ready(blue.characterLibrary.FetchRecipe(build.content.recipe))).value : [];
        const set = recipe.find(entry => typeof entry?.path === "string" && entry.path.startsWith(category + "/"));
        const option = set ? set.path.split("/").at(-1) : [ ...this._definitions.keys() ][0] ?? "";
        component.Configure([ ...this._definitions.keys() ].map(id => ({ id })), new Map(), {
            option,
            resolve: async id => { await this.Prepare(id); return { colorAreas: [] }; }
        });
        component.enabled = !!set;
        // An option the recipe turns on draws from the first apply.
        if (set) await this.Prepare(option);
    }

    /**
     * Reads an option's type and makes its layers, once.
     * @param {string} id The option.
     * @returns {Promise<void>}
     * @throws {Error} For a type that is not a plain part tuple, an option folder with geometry or palettes, a map name
     *   the role lookup does not know, a role that is not drawn on its own, draws through a diffuse coverage or feeds
     *   a property its pass does not compose, or two maps feeding one region's property.
     */
    async Prepare(id)
    {
        if (this._options.has(id)) return;
        const build = this._build, c = this._compositor, path = this._definitions.get(id);
        const value = (await build.Ready(blue.characterLibrary.FetchType(path))).value;
        if (!Array.isArray(value) || value.length !== 3 || value[1] || value[2]) throw Error("Unsupported skin detail definition");
        const dir = build.content.root + value[0] + "/", files = this._files.filter(file => file.startsWith(dir)), regions = {};
        if (files.some(file => /\.(gr2|black|yaml|color)$/.test(file))) throw Error("Unqualified skin detail dependency");
        // One map per name, at the character texture quality.
        const maps = [ ...new Set(files.filter(file => file.endsWith(".png")).map(file => CjsPaperDollDefinition.splitTier(file)[0])) ]
            .map(stem => CjsPaperDollDefinition.pickTier(stem + ".png", files));
        for (const path of maps)
        {
            const role = CjsPaperDollTextureRoles.lookup(path);
            // A map decal draws each map alone: no zone input, no diffuse to cover a map with.
            if (!role.operation || !this._properties.includes(role.property)
                || role.covered && maps.some(other => CjsPaperDollTextureRoles.lookup(other).property === "DiffuseMap"))
                throw Error("Unsupported skin detail map " + path);
            const channels = regions[role.region] ??= {};
            if (channels[role.property]) throw Error("Ambiguous detail channel " + path);
            const texture = await c.Texture(path), cutout = CjsPaperDollCompositor.crop(texture);
            channels[role.property] = { path, region: cutout, effect: await c[role.operation](texture, cutout) };
        }
        if (value[0].split("/").at(-1) !== id) throw Error("Skin detail type " + path + " names " + value[0]);
        this._options.set(id, { id, definition: path, regions });
    }

    /**
     * The option's layer for a region and channel, or none.
     * @param {{ option: string }} value The part's capture.
     * @param {string} region The output's region.
     * @param {string} channel The output's channel.
     * @returns {Array<{ effect: object, region: Float32Array }>}
     */
    GetLayers(value, region, channel)
    {
        const layer = this._options.get(value.option)?.regions[region]?.[channel];
        return layer ? [ { effect: layer.effect, region: layer.region } ] : [];
    }

    /**
     * The prepared options, for the build report: each option's maps and cutouts.
     * @returns {object[]}
     */
    Describe()
    {
        return [ ...this._options.values() ].map(option => ({
            id: option.id,
            definition: option.definition,
            regions: Object.fromEntries(Object.entries(option.regions).map(([ region, channels ]) => [ region,
                Object.fromEntries(Object.entries(channels).map(([ channel, layer ]) => [ channel, { path: layer.path, cutout: Array.from(layer.region) } ])) ]))
        }));
    }

}
