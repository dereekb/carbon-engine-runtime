import { blue } from "#blue";
import { CjsPaperDollCompositor } from "../compositor/CjsPaperDollCompositor.js";
import { CjsPaperDollDefinition } from "../CjsPaperDollDefinition.js";
import { PaperDollBlend } from "../paperDollOrder.js";
import { CjsCharacterTextureRoles } from "../../library/CjsCharacterTextureRoles.js";

/**
 * The layer source of a map-decal part (`static blend = PaperDollBlend.DECAL`: aging, freckles, scarring, scars,
 * augmentations), whose options are folders of composed maps (`comp_<region>_<suffix>`). Each of an option's maps draws over the
 * composition output its role feeds (`CjsCharacterTextureRoles.lookup`: region, property, operation), whichever target
 * that output belongs to; the roles come from the files the option actually holds.
 *
 * An option is a `.type` file, its id the file's name. The type names the part folder and a variation: a variation
 * names a subfolder, and `v0` (or none) is the part folder itself (character-creator-reference.md, augmentations).
 * A variation's maps replace the part folder's of the same name and the part folder's others stay. Derived: this
 * matches Graphene's working behaviour, today's look (Graphene 6a47517 largeScars.js: "v1 overrides present channels
 * and retains base specular"); no source states it. Options are listed from the file index;
 * an option's type, maps and metadata (`occludesModifiers`) are read the first time it is applied
 * (`CjsPaperDollComponent.ResolveOption`).
 *
 * A role drawn through a coverage (`covered`) draws through the option's own diffuse alpha, placed at the diffuse's
 * cutout: a scar's specular is a uniform full-placement map that would otherwise cover the whole head. Derived: our
 * decision of 2026-10-25, matching Graphene's working behaviour, today's look (Graphene 6a47517 largeScars.js:46-55);
 * no source states it.
 *
 * Ours (no Carbon counterpart): Carbon ships no paper doll; the client's is Python. Moved from Graphene's
 * `surfaceDetails.js`, `freckleOptions.js`, `largeScars.js` and `augmentations.js` (character-structure-and-plugins.md
 * R5); the name is a working name.
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

    /** Each prepared option: its id, type path, occlusion targets and per-region, per-property layers. @type {Map<string, object>} */
    _options = new Map();

    /** The part folder's files. @type {string[]} */
    _files = [];

    /**
     * @param {CjsPaperDollCompositor} compositor The compositor its layers are made with.
     * @param {{ Ready: function(Promise<*>): Promise<*>, content: { root: string, recipe: string } }} build The build served.
     * @param {string} name The definition part.
     */
    constructor(compositor, build, name)
    {
        this._compositor = compositor;
        this._build = build;
        this.name = name;
    }


    /**
     * A source for every definition part whose class composes as a decal (`static blend = PaperDollBlend.DECAL`), each
     * configured and set on the composition.
     * @param {import("./CjsPaperDollComposition.js").CjsPaperDollComposition} composition The composition.
     * @param {import("../CjsPaperDollDefinition.js").CjsPaperDollDefinition} definition The paper doll definition.
     * @param {{ Ready: function(Promise<*>): Promise<*>, content: { root: string, recipe: string } }} build The build served.
     * @returns {Promise<Map<string, CjsPaperDollMapDecalSource>>} The sources, by part.
     */
    static async prepareAll(composition, definition, build)
    {
        const sources = new Map();
        for (const name of CjsPaperDollDefinition.parts)
        {
            const type = definition[name].constructor;
            if (type.blend !== PaperDollBlend.DECAL) continue;
            const source = new CjsPaperDollMapDecalSource(composition.compositor, build, name);
            await source.Configure(definition, CjsPaperDollDefinition.listFiles(build.content.root + type.category));
            composition.SetSource(name, source);
            sources.set(name, source);
        }
        return sources;
    }

    /**
     * Lists the part's options and configures the definition's component with them: the option the build's recipe
     * sets for the part's category, on; with no recipe entry, the first option, off. Loading a recipe applies
     * everything it sets (operator, 2026-11-08); a character built without one starts with the part off. The
     * recipe's weight is not applied: the layers draw at full strength, and the shipped recipes set 1.0.
     * @param {import("../CjsPaperDollDefinition.js").CjsPaperDollDefinition} definition The paper doll definition.
     * @param {string[]} files The part folder's files.
     * @returns {Promise<void>}
     * @throws {Error} For a recipe entry naming an option the part does not list.
     */
    async Configure(definition, files)
    {
        const build = this._build, component = definition[this.name], category = component.constructor.category;
        this._files = files;
        this._definitions = new Map(files.filter(path => path.endsWith(".type")).map(path => [ path.split("/").at(-1).slice(0, -5), path ]));
        const recipe = build.content.recipe ? (await build.Ready(blue.characterLibrary.FetchRecipe(build.content.recipe))).GetModifiers() : [];
        const set = recipe.find(entry => entry.path.startsWith(category + "/"));
        const option = set ? set.path.split("/").at(-1) : [ ...this._definitions.keys() ][0] ?? "";
        if (set && !this._definitions.has(option)) throw Error("The recipe sets " + set.path + ", which " + category + " does not list");
        // An option's path is its part folder below the content root; occlusion matches against it.
        const root = build.content.root;
        component.Configure([ ...this._definitions ].map(([ id, path ]) => ({ id, path: path.slice(root.length, path.indexOf("/types/")) })), new Map(), {
            option,
            resolve: async id =>
            {
                await this.Prepare(id);
                const prepared = this._options.get(id);
                return { path: prepared.path, occludes: prepared.occludes, colorAreas: [] };
            }
        });
        component.enabled = !!set;
        // An option the recipe turns on draws from the first apply.
        if (set) await this.Prepare(option);
    }

    /**
     * Reads an option's type and makes its layers, once.
     * @param {string} id The option.
     * @returns {Promise<void>}
     * @throws {Error} For a type that is not a part, variation and no colour variant; a variation with no folder that
     *   is not `v0`; or a map name the role lookup does not know or a role not drawn on its own.
     */
    async Prepare(id)
    {
        if (this._options.has(id)) return;
        const build = this._build, c = this._compositor, path = this._definitions.get(id);
        const value = (await build.Ready(blue.characterLibrary.FetchType(path))).value;
        if (!Array.isArray(value) || value.length !== 3 || typeof value[0] !== "string" || typeof value[1] !== "string" || value[2])
            throw Error("Unsupported map decal type " + path);
        const dir = build.content.root + value[0] + "/", variant = value[1] ? dir + value[1] + "/" : dir;
        const inFolder = folder => this._files.filter(file => file.startsWith(folder) && file.lastIndexOf("/") === folder.length - 1 && file.endsWith(".png"));
        const own = inFolder(variant);
        if (variant !== dir && !own.length && value[1] !== "v0") throw Error("Map decal type " + path + " names a variation with no folder");
        // One map per name at the character texture quality; the variation's replace the part folder's of that name.
        const pick = files => new Map([ ...new Set(files.map(file => CjsPaperDollDefinition.splitTier(file)[0].split("/").at(-1))) ]
            .map(name => [ name, CjsPaperDollDefinition.pickTier(files[0].slice(0, files[0].lastIndexOf("/") + 1) + name + ".png", files) ]));
        const maps = new Map([ ...(variant !== dir ? pick(inFolder(dir)) : []), ...(own.length ? pick(own) : []) ]);
        // What the option occludes: the first metadata among its variation's folder and its part folder.
        const metadata = [ variant, dir ].map(folder => folder + "metadata.yaml").find(file => this._files.includes(file));
        const occludes = metadata
            ? [ ...new Set((await build.Ready(blue.characterLibrary.FetchAvatarPartMetaData(metadata))).occludesModifiers.map(value => value.split("#")[0])) ]
            : [];
        const roles = [ ...maps.values() ].map(file => CjsCharacterTextureRoles.lookup(file));
        // Per region and property, replacements before additions.
        roles.sort((a, b) => (a.plan === "add") - (b.plan === "add"));
        const regions = {};
        for (const role of roles)
        {
            if (!role.operation) throw Error("Unsupported map decal map " + role.path);
            const channels = regions[role.region] ??= {}, texture = await c.Texture(role.path);
            (channels[role.property] ??= []).push({ path: role.path, role, texture, region: CjsPaperDollCompositor.crop(texture), effect: null });
        }
        for (const channels of Object.values(regions)) for (const layer of Object.values(channels).flat())
        {
            // The coverage is the option's diffuse: one diffuse map per region, or an error.
            const owner = layer.role.covered ? CjsCharacterTextureRoles.one(channels.DiffuseMap ?? [], () => true) : null;
            if (owner) layer.region = owner.region;
            layer.effect = owner ? await c.Simple(layer.texture, owner.region, owner.texture, owner.region) : await c[layer.role.operation](layer.texture, layer.region);
        }
        this._options.set(id, { id, definition: path, path: value[0], occludes, regions });
    }

    /**
     * Whether an option's maps are prepared (its first apply has finished loading them).
     * @param {string} id The option.
     * @returns {boolean}
     */
    IsPrepared(id)
    {
        return this._options.has(id);
    }

    /**
     * The option's layers for a region and channel, in drawing order; none when it has none there.
     * @param {{ option: string }} value The part's capture.
     * @param {string} region The output's region.
     * @param {string} channel The output's channel.
     * @returns {Array<{ effect: object, region: Float32Array }>}
     */
    GetLayers(value, region, channel)
    {
        const layers = this._options.get(value.option)?.regions[region]?.[channel] ?? [];
        return layers.map(layer => ({ effect: layer.effect, region: layer.region }));
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
                Object.fromEntries(Object.entries(channels).map(([ channel, layers ]) => [ channel, layers.map(layer => ({ path: layer.path, cutout: Array.from(layer.region) })) ])) ]))
        }));
    }

}
