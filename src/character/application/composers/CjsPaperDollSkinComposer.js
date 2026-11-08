import { blue } from "#blue";
import { CjsPaperDollCompositor } from "../compositor/CjsPaperDollCompositor.js";
import { CjsPaperDollMaterialLayer } from "../compositor/CjsPaperDollMaterialLayer.js";
import { CjsPaperDollDefinition } from "../CjsPaperDollDefinition.js";

/** The skin palettes' shade names, as the creator labels them (`<bloodline>_<shade>.color`). */
const SHADES = { light: "Light", midlight: "Mid-light", default: "Default", middark: "Mid-dark", dark: "Dark" };

/**
 * A paper doll's skin pass, the first of `CjsPaperDollInstance.passOrder`: the skin tone's palettes, and the head and
 * body base maps, each the selected foundation's diffuse with the skin-tone layer colourised over it.
 *
 * Each region draws into the other of its two targets on every apply, so a composition that consumers still sample
 * is never drawn into.
 *
 * Ours (no Carbon counterpart): Carbon ships no paper doll; the client's is Python. Moved from Graphene's
 * `skinColour.js` (character-structure-and-plugins.md R5); the name is a working name.
 */
export class CjsPaperDollSkinComposer
{

    static className = "CjsPaperDollSkinComposer";

    /**
     * The compositor every skin draw goes through; its owner renews and releases it.
     * @type {CjsPaperDollCompositor}
     */
    compositor = null;

    /** The build served: its cancellation, its waits and its report (`report.skin`). */
    _build = null;

    /** The skin folder, `<content root>skintone/basic/`. */
    _root = "";

    /** The prepared foundations by id, the map `PrepareFoundation` adds to. @type {?Map<string, object>} */
    _foundations = null;

    /** Each foundation's copied head and body diffuse maps, by foundation id. @type {Map<string, object>} */
    _foundationCopies = new Map();

    /** Per region (`head`, `body`): its inputs, prepared effects and two targets. @type {Record<string, object>} */
    _regions = {};

    /** The body effects' diffuse parameters the composed body base binds to. @type {object[]} */
    _bodyParameters = [];

    /** The definition whose `skin` the report reads. */
    _definition = null;

    /** Notes a change, for the build's log. @type {function(string): void} */
    _onChange = null;

    /**
     * @param {object} context The main render context.
     * @param {{ CheckActive: function(): void, Ready: function(Promise<*>): Promise<*>, report: object, content: { root: string } }} build
     *   The build served: its cancellation and waits (as `CjsPaperDollCompositor` takes them), its report and content root.
     */
    constructor(context, build)
    {
        this._build = build;
        this.compositor = new CjsPaperDollCompositor(context, build);
    }

    /**
     * Reads every bloodline palette, prepares the head and body inputs over the selected foundation, configures the
     * definition's skin, and draws the initial skin.
     * @param {import("../CjsPaperDollDefinition.js").CjsPaperDollDefinition} definition The paper doll definition; its
     *   `skin` component is configured here.
     * @param {object} foundation The selected foundation.
     * @param {Map<string, object>} foundations The foundations prepared so far, by id; another joins with `PrepareFoundation`.
     * @param {object[]} bodyParameters The body effects' diffuse parameters the composed body base binds to.
     * @param {function(string): void} onChange Notes a change.
     * @returns {Promise<void>}
     */
    async Prepare(definition, foundation, foundations, bodyParameters, onChange)
    {
        const build = this._build, c = this.compositor;
        const root = this._root = build.content.root + "skintone/basic/";
        this._definition = definition;
        this._foundations = foundations;
        this._bodyParameters = bodyParameters;
        this._onChange = onChange;

        // Every bloodline's palettes (<bloodline>_<light|midlight|default|middark|dark>.color) and the neutral default,
        // by name: a palette's colours are fetched when it is applied, and only the initial palette is read here.
        // Their specular colours (absent from some) are not read: the skin specular is not composed yet.
        const paletteFiles = CjsPaperDollDefinition.listFiles(root).filter(path => path.endsWith(".color") && !path.slice(root.length).includes("/"));
        const initial = await build.Ready(blue.characterLibrary.FetchPalette(root + "deteis_default.color", { pattern: "reject" }));
        const records = [];
        for (const path of paletteFiles)
        {
            const name = path.slice(root.length, -".color".length), [ bloodline, shade ] = name.split("_");
            records.push({ path, label: name === "default" ? "Neutral" : bloodline[0].toUpperCase() + bloodline.slice(1) + " · " + (SHADES[shade] ?? shade) });
        }
        records.sort((a, b) => a.path.localeCompare(b.path));

        const areas = new Set();
        for (const region of [ "head", "body" ])
        {
            const pick = name => CjsPaperDollDefinition.pickTier(root + name, CjsPaperDollDefinition.listFiles(root));
            const [ base, detail, zone ] = await Promise.all([
                c.Texture(foundation.bindings[region].DiffuseMap),
                c.Texture(pick("colorize_" + region + "_l.png")),
                c.Texture(pick("colorize_" + region + "_z.png"))
            ]);
            const colorAreas = await c.ColorAreas(detail, zone);
            const skinAlpha = CjsPaperDollSkinComposer.medianAlpha(detail);
            for (const area of colorAreas) areas.add(area);
            // With the skin-tone layer drawn, the composite takes that layer's alpha: the base's colour with the
            // detail's alpha, which is uniform (50/255, within 2, over the whole head and body detail), set as the
            // current base copy's alpha multiplier in _Render (so a foundation switch keeps it). The avatar shaders
            // darken the torso's inner backing by the composite's alpha, so an alpha of 1 drew it near-black, a line
            // round the neck. The layer's own draws write colour only (RM_ALPHA_ADDITIVE).
            const baseCopy = await c.Copy(base);
            const paint = c.Colorized(detail, CjsPaperDollCompositor.crop(detail), zone, CjsPaperDollCompositor.crop(zone), initial.colors);
            // The content's head maps are 2048x1024 and its body maps 2048x2048.
            const width = 2048, height = region === "head" ? 1024 : 2048;
            const buffers = [ c.TargetTexture(width, height), c.TargetTexture(width, height) ];
            this._regions[region] = { base, detail, zone, colorAreas, baseCopy, skinAlpha, paint, width, height, buffers, active: 0 };
        }
        for (const [ id, value ] of foundations) await this.PrepareFoundation(id, value);

        definition.skin.Configure([ {
            id: "basic",
            colorAreas: [ ...areas ].sort(),
            defaultPalette: root + "deteis_default.color",
            palettes: records.map(({ path, label }) => ({ path, label }))
        } ], new Map(), { option: "basic" });
        build.report.skin = {
            build: "resource index",
            regions: Object.fromEntries(Object.entries(this._regions).map(([ key, r ]) => [ key, {
                base: r.base.path,
                detail: r.detail.path,
                zone: r.zone.path,
                detailCrop: Array.from(CjsPaperDollCompositor.crop(r.detail)),
                zoneCrop: Array.from(CjsPaperDollCompositor.crop(r.zone)),
                colorAreas: r.colorAreas
            } ])),
            updates: 0,
            baseFile: "deteis.base retained as evidence; not multiplied into colours"
        };
        this._Render({ option: "basic", colors: definition.skin.GetColors() });
    }

    /**
     * Copies one foundation's head and body diffuse maps, the base its skin draws over; once per foundation.
     * @param {string} id The foundation's id.
     * @param {object} value The prepared foundation.
     * @returns {Promise<void>}
     */
    async PrepareFoundation(id, value)
    {
        if (this._foundationCopies.has(id)) return;
        const c = this.compositor, copies = {};
        for (const region of [ "head", "body" ]) copies[region] = await c.Copy(await c.Texture(value.bindings[region].DiffuseMap));
        this._foundationCopies.set(id, copies);
    }

    /**
     * Draws the skin over a prepared foundation's base maps from the next apply.
     * @param {string} id The foundation's id.
     * @returns {void}
     * @throws {Error} For a foundation `PrepareFoundation` has not copied.
     */
    SelectFoundation(id)
    {
        const copies = this._foundationCopies.get(id);
        if (!copies) throw Error("Unprepared skin foundation " + id);
        const report = this._build.report.skin;
        for (const region of [ "head", "body" ])
        {
            this._regions[region].baseCopy = copies[region];
            report.regions[region].base = this._foundations.get(id).bindings[region].DiffuseMap;
        }
        report.foundation = id;
    }

    /** The composed body base, the texture resource of the target drawn last. */
    get bodyTexture()
    {
        const region = this._regions.body;
        return region.buffers[region.active].resource;
    }

    /** The composed head base, the texture resource of the target drawn last. */
    get headTexture()
    {
        const region = this._regions.head;
        return region.buffers[region.active].resource;
    }

    /**
     * The pass's binding (`CjsPaperDollInstance`'s `skin`): draws the captured skin and binds the body base.
     * @param {object} pass The skin pass's capture; its `skin` entry holds the option and colours.
     * @returns {void}
     */
    Apply(pass)
    {
        const value = pass.skin, out = this._Render(value), report = this._build.report.skin;
        for (const parameter of this._bodyParameters) parameter.SetResource(out.body.resource);
        report.selected = this._definition.skin.palette;
        report.enabled = this._definition.skin.enabled;
        report.colors = value.colors.map(color => Array.from(color));
        report.updates++;
        this._onChange("skin palette applied");
    }

    /**
     * Releases the compositor and everything it made.
     * @returns {void}
     */
    Destruct()
    {
        this.compositor.Destruct();
    }

    /**
     * Draws each region into its other target: the foundation base, then the colourised skin tone when an option is set.
     * @param {{ option: string, colors: ArrayLike<number>[] }} value The skin's option and colours.
     * @returns {Record<string, object>} Each region's drawn target, with its index.
     */
    _Render(value)
    {
        const c = this.compositor, completed = {};
        for (const [ region, r ] of Object.entries(this._regions))
        {
            const next = 1 - r.active, buffer = r.buffers[next];
            r.baseCopy.SetParameter("AlphaMultiplier", value.option ? r.skinAlpha : 1);
            c.Draw(buffer.target, r.width, r.height, r.baseCopy, CjsPaperDollCompositor.full, true);
            if (value.option)
            {
                CjsPaperDollMaterialLayer.setColors(r.paint, value.colors);
                c.Draw(buffer.target, r.width, r.height, r.paint, CjsPaperDollCompositor.crop(r.detail));
            }
            completed[region] = { ...buffer, index: next };
        }
        for (const region of [ "head", "body" ]) this._regions[region].active = completed[region].index;
        return completed;
    }

    /**
     * A loaded RGBA texture's alpha as one value: the median of a 1/16 grid of its texels, from 0 to 1.
     * @param {object} texture A ready `TriTextureRes` with its CPU bitmap.
     * @returns {number} The alpha.
     */
    static medianAlpha(texture)
    {
        const bitmap = texture.loadedBitmap, data = bitmap.GetMipRawData(0), pitch = bitmap.GetPitch(), values = [];
        for (let y = 0; y < texture.height; y += 16) for (let x = 0; x < texture.width; x += 16) values.push(data[y * pitch + x * 4 + 3]);
        values.sort((a, b) => a - b);
        return values[values.length >> 1] / 255;
    }

}
