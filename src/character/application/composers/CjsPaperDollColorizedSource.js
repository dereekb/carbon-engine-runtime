import { blue } from "#blue";
import { CjsPaperDollCompositor } from "../compositor/CjsPaperDollCompositor.js";
import { CjsPaperDollMaterialLayer } from "../compositor/CjsPaperDollMaterialLayer.js";
import { CjsPaperDollDefinition } from "../CjsPaperDollDefinition.js";
import { PaperDollBlend } from "../paperDollOrder.js";
import { CjsPaperDollMakeupCatalog } from "./CjsPaperDollMakeupCatalog.js";
import { CjsPaperDollTextureRoles } from "./CjsPaperDollTextureRoles.js";

/**
 * The layer source of a colourised head part: each option's colourise detail (`l`) through its zone map (`z`), in the
 * captured colours, at the captured weight (colorizedblit: character-compositing.md:367; the roles through
 * `CjsPaperDollTextureRoles`). It draws into the head diffuse only.
 *
 * Its options are listed by the part's rule (`static menu`), each moved as it was from Graphene:
 * - `swatches` (eye shadow, eyeliner; `eyeMakeup.js`): each `.type` in the part's folder is a style, whose palettes are
 *   its own `.color` files by name. A style with swatches (`<name>_a.color`, `<name>_bc.color`) is picked by swatch:
 *   colour area 1 from an `_a` swatch, areas 2 and 3 from a `_bc` swatch; one without, by its whole palettes. Its
 *   default palette is `default.color`, else the first by label.
 * - `catalog` (blush; `blushOptions.js`, `headComposition.js`): the makeup catalog's options, every option's palettes
 *   merged by value into one menu (equal labels told apart by folder). The recipe's colours (else its colour variation,
 *   else the option's default palette) are the default palette of every option without its own: the menu's palette of
 *   those colours, or `authored` when none matches. Its weight is the recipe's, 0 without an entry.
 * An option's maps and colour areas are read the first time it is applied.
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
     * A source for every definition part that composes colourised with a listing rule (`static blend` COLORIZE and
     * `static menu`), each configured and set on the composition.
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
            if (type.blend !== PaperDollBlend.COLORIZE || !type.menu) continue;
            const source = new CjsPaperDollColorizedSource(composition.compositor, build, name);
            await build.Ready(type.menu === "catalog" ? source.ConfigureCatalog(definition) : source.Configure(definition));
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
        const label = name => name[0].toUpperCase() + name.slice(1);
        for (const type of files.filter(file => file.endsWith(".type")))
        {
            const folder = type.slice(0, type.indexOf("/types/") + 1), id = folder.slice(root.length, -1);
            // Palettes by name only; a palette's colours are fetched when it is applied.
            const own = files.filter(file => file.startsWith(folder) && file.lastIndexOf("/") === folder.length - 1 && file.endsWith(".color"));
            const swatches = own.some(file => file.endsWith("_a.color"));
            const records = [], secondaryRecords = [];
            for (const path of own)
            {
                const name = path.slice(folder.length, -".color".length);
                const kind = name.endsWith("_a") ? "a" : name.endsWith("_bc") ? "bc" : "";
                // A style with swatches is picked by swatch; one without, by its whole palettes.
                if (swatches !== (kind !== "")) continue;
                (kind === "bc" ? secondaryRecords : records).push({ path, label: label(kind ? name.slice(0, -kind.length - 1) : name) });
            }
            if (!records.length) throw new Error("A " + this.name + " style without palettes " + folder);
            records.sort((a, b) => a.label.localeCompare(b.label));
            secondaryRecords.sort((a, b) => a.label.localeCompare(b.label));
            const defaultPalette = (records.find(record => record.path.endsWith("/default.color")) ?? records[0]).path;
            this._styles.set(id, { id, folder, records, secondaryRecords, defaultPalette, paint: null, region: null });
        }
        const recipe = build.content.recipe ? (await build.Ready(blue.characterLibrary.FetchRecipe(build.content.recipe))).GetModifiers() : [];
        const set = recipe.find(entry => entry.path.startsWith(category + "/")) ?? null;
        const option = set ? set.path.split("/").at(-1) : "";
        if (set && !this._styles.has(option)) throw new Error("The recipe sets " + set.path + ", which " + category + " does not list");
        const authored = set ? set.GetColors() : null, AUTHORED = CjsPaperDollColorizedSource.authored;
        component.Configure([ ...this._styles.values() ].map(style =>
        {
            // The recipe's style starts in the recipe's colours: its default palette is `authored`, with no secondary.
            const recipe = authored !== null && style.id === option;
            return {
                id: style.id,
                defaultPalette: recipe ? AUTHORED : style.defaultPalette,
                palettes: recipe ? [ ...style.records, { path: AUTHORED, label: "Authored colours" } ] : style.records,
                ...(style.secondaryRecords.length ? { secondaryPalettes: style.secondaryRecords, ...(recipe ? {} : { defaultSecondaryPalette: style.secondaryRecords[0].path }) } : {})
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
            build.Ready(blue.characterLibrary.FetchPalette(style.defaultPalette)),
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
        this._catalog = new Map(catalog.options.map(option => [ option.id, option ]));
        // Every option's palettes, merged by value: each path aliases the first palette of its colours.
        const palettes = new Map(), aliases = new Map(), byValue = new Map();
        for (const entry of catalog.options.flatMap(option => option.palettes))
        {
            if (aliases.has(entry.path)) continue;
            const { colors } = await build.Ready(blue.characterLibrary.FetchPalette(entry.path, { pattern: "reject", neutralSpecular: true }));
            const key = JSON.stringify(colors.map(value => Array.from(value))), existing = byValue.get(key);
            if (existing) { palettes.get(existing).sources.push(entry.path); aliases.set(entry.path, existing); continue; }
            byValue.set(key, entry.path);
            aliases.set(entry.path, entry.path);
            palettes.set(entry.path, { label: entry.label, colors, sources: [ entry.path ] });
        }
        const labels = new Map();
        for (const value of palettes.values()) labels.set(value.label, (labels.get(value.label) ?? 0) + 1);
        for (const [ path, value ] of palettes) if (labels.get(value.label) > 1) value.label += " (" + path.split("/").at(-2) + ")";
        const recipe = build.content.recipe ? (await build.Ready(blue.characterLibrary.FetchRecipe(build.content.recipe))).GetModifiers() : [];
        const entries = recipe.filter(entry => entry.path.startsWith(category + "/"));
        if (entries.length > 1 || entries.length && (entries[0].weight < 0 || entries[0].weight > 1)) throw new Error("Invalid " + this.name + " recipe entry");
        const set = entries.length ? entries[0] : null;
        const initial = set ? catalog.options.find(option => option.part === set.path) : catalog.options[0];
        if (!initial) throw new Error("The recipe sets " + set.path + ", which " + category + " does not list");
        const folder = build.content.root + initial.part + "/";
        const authored = set ? set.GetColors() : null;
        const colors = authored ?? (await build.Ready(blue.characterLibrary.FetchPalette(set && set.colorvariation
            ? folder + set.colorvariation + ".color" : initial.defaultPalette ?? initial.palettes[0].path))).colors;
        let initialPalette = [ ...palettes ].find(([ , value ]) => value.colors.every((color, i) => color.every((channel, c) => channel === colors[i][c])));
        initialPalette = initialPalette ? initialPalette[0] : null;
        if (!initialPalette)
        {
            initialPalette = CjsPaperDollColorizedSource.authored;
            palettes.set(initialPalette, { label: "Authored colours", colors, sources: [ build.content.recipe ] });
        }
        const menu = [ ...palettes ].map(([ path, value ]) => ({ path, label: value.label }));
        component.Configure(catalog.options.map(option => ({
            id: option.id,
            colorAreas: [],
            defaultPalette: option.defaultPalette ? aliases.get(option.defaultPalette) : initialPalette,
            palettes: menu
        })), new Map([ ...palettes ].map(([ path, value ]) => [ path, value.colors ])), {
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
        const dependants = option.metadata ? option.metadata.dependantModifiers : [];
        if (option.geometry.length || dependants.length) throw new Error("Unqualified " + this.name + " geometry or dependency " + option.definition);
        const roles = Object.values(option.channels).map(value => CjsPaperDollTextureRoles.lookup(value.path));
        if (roles.some(role => role.suffix !== "l" && role.suffix !== "z")) throw new Error("Unqualified " + this.name + " material channel " + option.definition);
        const detailMap = CjsPaperDollTextureRoles.one(roles, role => role.operation === "Colorized");
        const zoneMap = CjsPaperDollTextureRoles.one(roles, role => role.inputOf === "l");
        if (!detailMap || !zoneMap) throw new Error("Incomplete " + this.name + " inputs " + option.definition);
        const [ detail, zone ] = await Promise.all([ build.Ready(c.Texture(detailMap.path)), build.Ready(c.Texture(zoneMap.path)) ]);
        const region = CjsPaperDollCompositor.crop(detail), neutral = [ 0, 1, 2 ].map(() => Float32Array.of(.5, .5, .5, 1));
        const style = { id, region, paint: await c.Colorized(detail, region, zone, CjsPaperDollCompositor.crop(zone), neutral) };
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
        style.paint.SetParameter("Strength", value.weight);
        return [ { effect: style.paint, region: style.region } ];
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
