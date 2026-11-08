import { blue } from "#blue";
import { CjsPaperDollCompositor } from "../compositor/CjsPaperDollCompositor.js";
import { CjsPaperDollMaterialLayer } from "../compositor/CjsPaperDollMaterialLayer.js";
import { CjsPaperDollDefinition } from "../CjsPaperDollDefinition.js";
import { CjsPaperDollTextureRoles } from "./CjsPaperDollTextureRoles.js";

/**
 * The layer source of a colourised head part: each option's colourise detail (`l`) through its zone map (`z`), in the
 * captured colours, at the captured weight (colorizedblit: character-compositing.md:367; the roles through
 * `CjsPaperDollTextureRoles`). It draws into the head diffuse only.
 *
 * Its options are listed by the swatch rule (eye shadow, eyeliner; moved as it was from Graphene's `eyeMakeup.js`):
 * each `.type` in the part's folder is a style, whose palettes are its own `.color` files by name. A style with
 * swatches (`<name>_a.color`, `<name>_bc.color`) is picked by swatch: colour area 1 from an `_a` swatch, areas 2 and 3
 * from a `_bc` swatch; one without, by its whole palettes. Its default palette is `default.color`, else the first by
 * label. A style's maps, colour areas and default palette are read the first time it is applied.
 *
 * A loaded recipe applies what it sets (operator, 2026-11-08): its entry's option, on, at its weight, and its colours
 * as the option's default palette, `authored`. Derived, awaiting the operator (2026-11-09): the recipe's colours enter
 * as a selected palette, not as custom colours; custom colours would hold across option picks.
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

    /** The part folder's files. @type {string[]} */
    _files = [];

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
        const build = this._build, c = this._compositor, roles = CjsPaperDollTextureRoles.readFolder(style.folder, this._files);
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
