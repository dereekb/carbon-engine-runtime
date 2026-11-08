import { blue } from "#blue";
import { CjsPaperDollCompositor } from "../compositor/CjsPaperDollCompositor.js";
import { CjsPaperDollMaterialLayer } from "../compositor/CjsPaperDollMaterialLayer.js";
import { CjsPaperDollDefinition } from "../CjsPaperDollDefinition.js";
import { PaperDollBlend, PaperDollPaletteKind, PaperDollPalettes } from "../paperDollOrder.js";
import { CjsPaperDollMakeupCatalog } from "./CjsPaperDollMakeupCatalog.js";
import { CjsPaperDollTextureRoles } from "./CjsPaperDollTextureRoles.js";

/**
 * The layer source of a colourised head part: each option's colourise detail (`l`) through its zone map (`z`), in the
 * captured colours, at the captured weight (colorizedblit: character-compositing.md:367; the roles through
 * `CjsPaperDollTextureRoles`). It draws into the head diffuse only.
 *
 * Its options and their palette files come from where the part's palettes live (`static palettes`,
 * `PaperDollPalettes`): each option's own folder (eye shadow, eyeliner: each `.type` is a style, its palettes its own
 * `.color` files) or the category's catalog (blush, eyebrows: the makeup catalog's options, every option's `.color`
 * files and the category's `colors/`). Each palette is a raw record: its path, its file name, its kind
 * (`PaperDollPaletteKind`: the areas it sets, from its `_a`/`_bc` name) and those areas. An option's default palette
 * is a content fact only: its `default.color` (or the type's colour variant), else none; which palettes a menu shows,
 * how they are merged and labelled, and a default where there is none, are the UI's (operator: the UI makes the
 * configuration and UI decisions, not the engine).
 * An option's maps and colour areas are read the first time it is applied.
 *
 * A part with a carrier mesh (`static carrier`: the eyebrows) also gives what the brow carrier draws: the option's
 * colourised detail drawn unblended with its coverage (colorizedcopyblit), and its normal and specular as the mesh's
 * material. The carrier keeps the last applied option while the part is off or an option loads.
 *
 * A loaded recipe applies what it sets (operator, 2026-11-08): its entry's option, on, at its weight, and its colours
 * as a default palette. PROVISIONAL, awaiting the operator (Ruru's call, 2026-11-09): the recipe's colours enter as a
 * selected palette, not as custom colours; custom colours would hold across option picks.
 *
 * Ours (no Carbon counterpart): Carbon ships no paper doll; the client's is Python. The name is a working name.
 */
export class CjsPaperDollColorizedSource
{

    static className = "CjsPaperDollColorizedSource";

    /** The palette id the recipe's colours are registered under. */
    static authored = "authored";

    /** The colour areas each palette kind sets. */
    static areas = { [PaperDollPaletteKind.WHOLE]: [ 1, 2, 3 ], [PaperDollPaletteKind.AREA_1]: [ 1 ], [PaperDollPaletteKind.AREAS_2_3]: [ 2, 3 ] };

    /**
     * A palette file's raw record: its path, its file name, its kind (the areas it sets, from its `_a`/`_bc` name;
     * derived, as in the game's creator) and those areas. `authored` (the recipe's colours) sets all three.
     * @param {string} path The palette's `res:` path, or `authored`.
     * @returns {{ path: string, name: string, kind: number, areas: number[] }}
     */
    static record(path)
    {
        const name = path === CjsPaperDollColorizedSource.authored ? path : path.slice(path.lastIndexOf("/") + 1, -".color".length);
        const kind = name.endsWith("_a") ? PaperDollPaletteKind.AREA_1 : name.endsWith("_bc") ? PaperDollPaletteKind.AREAS_2_3 : PaperDollPaletteKind.WHOLE;
        return { path, name, kind, areas: CjsPaperDollColorizedSource.areas[kind] };
    }

    /**
     * Neutral grey in all three areas: a paint's colours before a capture's.
     * @returns {Float32Array[]}
     */
    static neutral()
    {
        return [ 0, 1, 2 ].map(() => Float32Array.of(.5, .5, .5, 1));
    }

    /** The definition part this source serves. */
    name = "";

    /** The compositor its layers are made with. @type {CjsPaperDollCompositor} */
    _compositor = null;

    /** The build served: its waits and its content. */
    _build = null;

    /** Each style, by id: its folder, palettes, and once applied its paint and cutout. @type {Map<string, object>} */
    _styles = new Map();

    /** The part folder's files (the swatch rule). @type {string[]} */
    _files = [];

    /** The catalog's options by id (the catalog rule). @type {Map<string, object>} */
    _catalog = new Map();

    /** Whether the part's paint draws at its weight setting (`static weighted`); without it, at full strength. */
    _weighted = true;

    /** The part's class, for its facts (`carrier`). */
    _type = null;

    /** The option the carrier last drew. @type {?object} */
    _carrierStyle = null;

    /**
     * @param {CjsPaperDollCompositor} compositor The compositor its layers are made with.
     * @param {{ Ready: function(Promise<*>): Promise<*>, CheckActive: function(): void, content: { root: string, recipe: string } }} build
     *   The build served.
     * @param {string} name The definition part.
     */
    constructor(compositor, build, name)
    {
        this._compositor = compositor;
        this._build = build;
        this.name = name;
    }

    /**
     * A source for every definition part that composes colourised from palette files (`static blend` COLORIZE and
     * `static palettes`), each configured and set on the composition.
     * @param {import("./CjsPaperDollComposition.js").CjsPaperDollComposition} composition The composition.
     * @param {import("../CjsPaperDollDefinition.js").CjsPaperDollDefinition} definition The paper doll definition.
     * @param {object} build The build served.
     * @returns {Promise<Map<string, CjsPaperDollColorizedSource>>} The sources, by part.
     */
    static async prepareAll(composition, definition, build)
    {
        const sources = new Map();
        for (const name of CjsPaperDollDefinition.parts)
        {
            const type = definition[name].constructor;
            if (type.blend !== PaperDollBlend.COLORIZE || !type.palettes) continue;
            const source = new CjsPaperDollColorizedSource(composition.compositor, build, name);
            await build.Ready(type.palettes === PaperDollPalettes.CATALOG ? source.ConfigureCatalog(definition) : source.Configure(definition));
            composition.SetSource(name, source);
            sources.set(name, source);
        }
        return sources;
    }

    /**
     * Lists the part's styles by the swatch rule and configures the definition's component with them, applying the
     * build's recipe entry for the part (option on, weight, colours as the `authored` palette); with no entry, no
     * option, off.
     * @param {import("../CjsPaperDollDefinition.js").CjsPaperDollDefinition} definition The paper doll definition.
     * @returns {Promise<void>}
     * @throws {Error} For a style without palettes, or a recipe entry naming a style the part does not list.
     */
    async Configure(definition)
    {
        const build = this._build, component = definition[this.name], category = component.constructor.category;
        const root = build.content.root + category + "/", files = this._files = CjsPaperDollDefinition.listFiles(root);
        this._type = component.constructor;
        this._weighted = component.constructor.weighted === true;
        for (const type of files.filter(file => file.endsWith(".type")))
        {
            const folder = type.slice(0, type.indexOf("/types/") + 1), id = folder.slice(root.length, -1);
            // Palettes by path only; a palette's colours are fetched when it is applied.
            const records = files.filter(file => file.startsWith(folder) && file.lastIndexOf("/") === folder.length - 1 && file.endsWith(".color"))
                .map(path => CjsPaperDollColorizedSource.record(path));
            if (!records.length) throw new Error("A " + this.name + " style without palettes " + folder);
            const defaultPalette = records.find(record => record.name === "default")?.path ?? null;
            this._styles.set(id, { id, folder, records, defaultPalette, paint: null, region: null, skipped: [] });
        }
        const recipe = build.content.recipe ? (await build.Ready(blue.characterLibrary.FetchRecipe(build.content.recipe))).GetModifiers() : [];
        const set = recipe.find(entry => entry.path.startsWith(category + "/")) ?? null;
        const option = set ? set.path.split("/").at(-1) : "";
        if (set && !this._styles.has(option)) throw new Error("The recipe sets " + set.path + ", which " + category + " does not list");
        const authored = set ? set.GetColors() : null, AUTHORED = CjsPaperDollColorizedSource.authored;
        component.Configure([ ...this._styles.values() ].map(style =>
        {
            // The recipe's style starts in the recipe's colours: its default palette is `authored`.
            const recipe = authored !== null && style.id === option;
            const primary = style.records.filter(record => record.kind !== PaperDollPaletteKind.AREAS_2_3);
            const secondary = style.records.filter(record => record.kind === PaperDollPaletteKind.AREAS_2_3);
            const defaultPalette = recipe ? AUTHORED : style.defaultPalette;
            return {
                id: style.id,
                ...(defaultPalette !== null ? { defaultPalette } : {}),
                palettes: recipe ? [ ...primary, CjsPaperDollColorizedSource.record(AUTHORED) ] : primary,
                ...(secondary.length ? { secondaryPalettes: secondary } : {})
            };
        }), new Map(authored ? [ [ AUTHORED, authored ] ] : []), { option, weight: set ? set.weight : 1, resolve: id => this._Resolve(this._styles.get(id)) });
        component.enabled = set !== null;
    }

    /**
     * Reads one style's maps, colour areas and default palette the first time it is applied, and makes its paint.
     * @param {object} style The style.
     * @returns {Promise<{ colorAreas: number[] }>} The component option's resolved fields.
     * @throws {Error} For a style without one colourise detail and zone map.
     */
    async _Resolve(style)
    {
        const build = this._build, c = this._compositor, { roles, skipped } = CjsPaperDollTextureRoles.readFolder(style.folder, this._files);
        // Maps named outside the composed naming are not drawn (derived: today's look; eyeshadow_02's aa_female_head_s).
        style.skipped = skipped;
        const detailMap = CjsPaperDollTextureRoles.one(roles, role => role.region === "head" && role.operation === "Colorized");
        const zoneMap = CjsPaperDollTextureRoles.one(roles, role => role.region === "head" && role.inputOf === "l");
        if (!detailMap || !zoneMap) throw new Error("Incomplete " + this.name + " style " + style.folder);
        const [ detail, zone, initial, colorAreas ] = await Promise.all([
            build.Ready(c.Texture(detailMap.path)), build.Ready(c.Texture(zoneMap.path)),
            style.defaultPalette !== null ? build.Ready(blue.characterLibrary.FetchPalette(style.defaultPalette)) : { colors: CjsPaperDollColorizedSource.neutral() },
            build.Ready(blue.characterLibrary.FetchMaterialMaskAreas__Zone(zoneMap.path))
        ]);
        build.CheckActive();
        style.region = CjsPaperDollCompositor.crop(detail);
        style.paint = await c.Colorized(detail, style.region, zone, CjsPaperDollCompositor.crop(zone), initial.colors);
        return { colorAreas };
    }

    /**
     * Lists the part's options by the catalog rule and configures the definition's component with them, applying the
     * build's recipe entry for the part (see the class).
     * @param {import("../CjsPaperDollDefinition.js").CjsPaperDollDefinition} definition The paper doll definition.
     * @returns {Promise<void>}
     * @throws {Error} For more than one recipe entry or a weight outside 0 to 1, or an entry naming no listed option.
     */
    async ConfigureCatalog(definition)
    {
        const build = this._build, component = definition[this.name], category = component.constructor.category;
        const catalog = await CjsPaperDollMakeupCatalog.read(category.split("/").at(-1), build);
        this._type = component.constructor;
        this._weighted = component.constructor.weighted === true;
        this._catalog = new Map(catalog.options.map(option => [ option.id, option ]));
        const recipe = build.content.recipe ? (await build.Ready(blue.characterLibrary.FetchRecipe(build.content.recipe))).GetModifiers() : [];
        const entries = recipe.filter(entry => entry.path.startsWith(category + "/"));
        if (entries.length > 1 || entries.length && (!Number.isFinite(entries[0].weight) || entries[0].weight < 0 || entries[0].weight > 1)) throw new Error("Invalid " + this.name + " recipe entry");
        const set = entries.length ? entries[0] : null;
        // Without a recipe entry the part starts off on the catalog's first option. Derived: our own default, awaiting the
        // defaults work (the operator: our own defaults come later).
        const initial = set ? catalog.options.find(option => option.part === set.path) : catalog.options[0];
        if (!initial) throw new Error("The recipe sets " + set.path + ", which " + category + " does not list");
        // The recipe's colours (else its colour variation, else the option's default) are `authored`: the default palette
        // of every option without its own. With no recipe entry such an option has no default. PROVISIONAL (Ruru,
        // 2026-11-09; derived item 19): an option's own default wins over the recipe's colours, which keeps today's brows;
        // the ruling says a loaded recipe applies what it sets, so the recipe option should take `authored` (a colour-space
        // check of the recipe's colours against the .color files is pending).
        let authored = null;
        if (set)
        {
            const folder = build.content.root + initial.part + "/";
            // An entry without colours or a colour variation falls back to the option's default palette, else its first.
            // PROVISIONAL (with the recipe-colours call, derived item 15): the first palette is our pick, not a source's.
            authored = set.GetColors() ?? (await build.Ready(blue.characterLibrary.FetchPalette(set.colorvariation
                ? folder + set.colorvariation + ".color" : initial.defaultPalette ?? initial.palettes[0].path))).colors;
        }
        const AUTHORED = CjsPaperDollColorizedSource.authored;
        component.Configure(catalog.options.map(option =>
        {
            const defaultPalette = option.defaultPalette ?? (authored !== null ? AUTHORED : null);
            return {
                id: option.id,
                colorAreas: [],
                ...(defaultPalette !== null ? { defaultPalette } : {}),
                palettes: [ ...option.palettes.map(record => CjsPaperDollColorizedSource.record(record.path)), ...(authored !== null ? [ CjsPaperDollColorizedSource.record(AUTHORED) ] : []) ]
            };
        }), new Map(authored !== null ? [ [ AUTHORED, authored ] ] : []), {
            option: initial.id, weight: set ? set.weight : 0, resolve: id => this._ResolveCatalog(id)
        });
        component.enabled = set !== null;
        // The recipe's option draws from the first apply.
        await component.ResolveOption(initial.id);
    }

    /**
     * Reads one catalog option's maps the first time it is applied, and makes its paint.
     * @param {string} id The option.
     * @returns {Promise<{ colorAreas: number[] }>} The component option's resolved fields.
     * @throws {Error} For an option with geometry, dependants or maps other than a colourise detail and zone map.
     */
    async _ResolveCatalog(id)
    {
        const build = this._build, c = this._compositor, option = this._catalog.get(id);
        const dependants = option.metadata ? option.metadata.dependantModifiers : [], carrier = this._type.carrier === true;
        if (option.geometry.length || dependants.length) throw new Error("Unqualified " + this.name + " geometry or dependency " + option.definition);
        if (carrier && option.metadata && ![ -1, 2 ].includes(option.metadata.numColorAreas)) throw new Error("Unqualified " + this.name + " colour areas " + option.definition);
        const roles = Object.values(option.channels).map(value => CjsPaperDollTextureRoles.lookup(value.path));
        // Without a carrier the option is a colourise detail and zone map only; a carrier's material adds n and s.
        const allowed = carrier ? [ "l", "z", "n", "s" ] : [ "l", "z" ];
        if (roles.some(role => !allowed.includes(role.suffix))) throw new Error("Unqualified " + this.name + " material channel " + option.definition);
        const detailMap = CjsPaperDollTextureRoles.one(roles, role => role.operation === "Colorized");
        const zoneMap = CjsPaperDollTextureRoles.one(roles, role => role.inputOf === "l");
        if (!detailMap || !zoneMap) throw new Error("Incomplete " + this.name + " inputs " + option.definition);
        const [ detail, zone ] = await Promise.all([ build.Ready(c.Texture(detailMap.path)), build.Ready(c.Texture(zoneMap.path)) ]);
        const region = CjsPaperDollCompositor.crop(detail), neutral = CjsPaperDollColorizedSource.neutral();
        const style = { id, region, paint: await c.Colorized(detail, region, zone, CjsPaperDollCompositor.crop(zone), neutral), carrier: null, material: null, skipped: [] };
        if (carrier)
        {
            const normalMap = CjsPaperDollTextureRoles.one(roles, role => role.property === "NormalMap");
            const specularMap = CjsPaperDollTextureRoles.one(roles, role => role.property === "SpecularMap");
            if (!normalMap || !specularMap) throw new Error("Incomplete " + this.name + " material " + option.definition);
            const [ normal, specular ] = await Promise.all([ build.Ready(c.Texture(normalMap.path)), build.Ready(c.Texture(specularMap.path)) ]);
            style.material = { NormalMap: normal, SpecularMap: await c.Material(specular) };
            // The carrier mesh samples its material over the whole image: a cutout map would need atlas placement.
            for (const resource of Object.values(style.material)) if (CjsPaperDollCompositor.crop(resource).some((value, i) => value !== CjsPaperDollCompositor.full[i]))
                throw new Error(this.name + " material requires atlas placement " + resource.GetPath());
            style.carrier = await c.ColorizedCopy(detail, region, zone, CjsPaperDollCompositor.crop(zone), neutral);
            this._carrierStyle ??= style;
        }
        this._styles.set(id, style);
        return { colorAreas: await c.ColorAreas(detail, zone) };
    }

    /**
     * The captured style's paint for the head diffuse, in the captured colours at the captured weight; none elsewhere,
     * for no style, or while the style's maps load.
     * @param {{ option: string, colors: Float32Array[], weight: number }} value The part's capture.
     * @param {string} region The output's region.
     * @param {string} channel The output's channel.
     * @returns {Array<{ effect: object, region: Float32Array }>}
     */
    GetLayers(value, region, channel)
    {
        const style = region === "head" && channel === "DiffuseMap" && value.option ? this._styles.get(value.option) : null;
        if (!style || !style.paint) return [];
        CjsPaperDollMaterialLayer.setColors(style.paint, value.colors);
        if (this._weighted) style.paint.SetParameter("Strength", value.weight);
        return [ { effect: style.paint, region: style.region } ];
    }

    /**
     * What the carrier mesh draws for a capture (a part with `static carrier`): the captured option's unblended
     * colourised detail in the captured colours, and its cutout; the last applied option's while the part is off or the
     * option loads. Derived: today's look (Graphene 6a47517 headComposition.js kept the last brow); the brow meshes are
     * hidden while the part is off, so the carrier's colour does not show then.
     * @param {{ option: string, colors: Float32Array[] }} value The part's capture.
     * @returns {{ effect: object, region: Float32Array, material: { NormalMap: object, SpecularMap: object } }}
     */
    GetCarrier(value)
    {
        const style = value.option ? this._styles.get(value.option) : undefined;
        if (style !== undefined && style.carrier !== null) this._carrierStyle = style;
        const carrier = this._carrierStyle;
        CjsPaperDollMaterialLayer.setColors(carrier.carrier, value.colors);
        return { effect: carrier.carrier, region: carrier.region, material: carrier.material };
    }

    /**
     * The prepared options, for the build report: each option's cutout, and the maps in its folder that are not
     * composed maps and so are not drawn (`CjsPaperDollTextureRoles.readFolder`'s `skipped`).
     * @returns {object[]}
     */
    Describe()
    {
        return [ ...this._styles.values() ].filter(style => style.paint !== null)
            .map(style => ({ id: style.id, cutout: Array.from(style.region), skipped: style.skipped }));
    }

    /**
     * The carrier mesh's material: the normal and specular of the option the carrier last drew.
     * @returns {{ NormalMap: object, SpecularMap: object }}
     */
    GetCarrierMaterial()
    {
        return this._carrierStyle.material;
    }

    /**
     * Whether an option's paint is made (its first apply has finished loading it).
     * @param {string} id The option.
     * @returns {boolean}
     */
    IsPrepared(id)
    {
        const style = this._styles.get(id);
        return style !== undefined && style.paint !== null;
    }

}
