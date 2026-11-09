import { CjsSchema, meta, type } from "#schema";
import { PaperDollTarget } from "./paperDollOrder.js";

/**
 * Engine inputs for one paper-doll part, with prepared option and palette tables.
 * Components hold values; the UI owns palette selection and custom-colour edits.
 * Schema notifications only mark pending work for the doll's Update.
 */
@meta.define("CjsPaperDollComponent")
export class CjsPaperDollComponent
{

    _defaultOption = "";

    _dirty = true;

    _options = new Map();

    /** The configured option resolver, or null when every option arrived fully described. */
    _resolve = null;

    /** Each option's resolution in flight or done, by id; a failed one is forgotten so it can be retried. */
    _resolving = new Map();

    /** The options whose resolution finished, by id. */
    _resolved = new Set();

    enabled = true;

    option = "";

    palette = "";

    customColors = false;

    color1 = Float32Array.of(.5, .5, .5, 1);

    color2 = Float32Array.of(.5, .5, .5, 1);

    color3 = Float32Array.of(.5, .5, .5, 1);

    /**
     * Whether the user may switch the part off (operator, 2026-11-09). While nothing that remains occludes the part, a
     * part that is not overridable cannot be switched off by the user; an occluder still removes it from the bake. The
     * default character's data sets it false for the underwear (`CjsCharacterFactory`). The engine only holds the flag
     * and the UI honours it.
     */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST | meta.NOTIFY)
    @type.boolean
    overridable = true;

    /**
     * Marks changed inputs for rebuilding without deriving or validating other values.
     * @param {string|string[]|null} _propertyName The notified input names.
     * @returns {void}
     */
    OnModified(_propertyName)
    {
        this.Rebuild();
    }

    /**
     * Installs option records.
     *
     * An option record needs only what the file index gives (`id`, `path`, `label`, swatch records by name).
     * What has to be read from an option's files (its `colorAreas`, `occludes`, `defaultPalette`, palettes) can
     * come later from `resolve`, which `ResolveOption` runs the first time the option is applied; until then the
     * option has no colour areas and occludes nothing.
     * @param {object[]} options The option records; `colorAreas` defaults to none.
     * @param {object} [settings] The default option and the resolver.
     * @param {string} [settings.option=""] The option Reset selects.
     * @param {?function(string): Promise<object>} [settings.resolve=null] Reads one option's remaining fields.
     * @returns {void}
     */
    Configure(options, { option = "", resolve = null } = {})
    {
        this._options = new Map(options.map(value => [value.id, {
            ...value,
            colorAreas: [...new Set(value.colorAreas ?? [])].sort()
        }]));
        this._resolve = resolve;
        this._resolving = new Map();
        this._resolved = new Set();
        this._defaultOption = option;
        this.Reset();
    }

    /**
     * Completes one option's record through the configured resolver, once per option: the fields it returns
     * replace the record's, and the inputs are marked for rebuilding. Concurrent calls share one resolution; a
     * failed one is forgotten, so the next call retries it.
     * @param {string} id The option's id; "" (no option) resolves to null.
     * @returns {Promise<?object>} The option's record, or null for "" or an unknown id.
     */
    ResolveOption(id)
    {
        const record = this._options.get(id) ?? null;
        if (!record || !this._resolve) return Promise.resolve(record);
        if (!this._resolving.has(id))
        {
            // Captured now: a resolution still in flight when the component is configured again marks the old sets.
            const resolving = this._resolving, resolved = this._resolved;
            const operation = this._resolve(id).then(fields =>
            {
                Object.assign(record, fields, { colorAreas: [...new Set(fields.colorAreas ?? [])].sort() });
                resolved.add(id);
                this.Rebuild();
                return record;
            });
            resolving.set(id, operation);
            operation.catch(() => { if (resolving.get(id) === operation) resolving.delete(id); });
        }
        return this._resolving.get(id);
    }

    /**
     * Whether an option's record is complete: its resolution finished, or the component has no resolver (every
     * option arrived fully described).
     * @cjs
     * @param {string} id The option's id.
     * @returns {boolean}
     */
    IsResolved(id)
    {
        return !this._resolve || this._resolved.has(id);
    }

    /** The component's declared colour inputs used by the selected option. */
    GetControls()
    {
        const areas = this.GetColorAreas();
        if (!areas.length) return [];

        const order = ["palette", "secondaryPalette", "customColors", "color1", "color2", "color3"];
        return CjsSchema.getSchema(this.constructor).members
            .filter(field => order.includes(field.key))
            .filter(field => !/^color\d$/.test(field.key) || areas.includes(Number(field.key.slice(5))))
            .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
    }

    /** Source-derived area identities, independent of whether this part is enabled. */
    GetColorAreas()
    {
        return this._options.get(this.option)?.colorAreas ?? [];
    }

    /** Prepared option choices, independent of their selected colours. */
    GetOptions()
    {
        return [...this._options.values()];
    }

    /** Authored palettes for the selected option, retaining a cross-option choice. */
    GetPalettes()
    {
        const result = [...(this._options.get(this.option)?.palettes ?? [])];
        if (this.palette && !result.some(value => value.path === this.palette))
        {
            result.push({ path: this.palette, label: "Retained colour" });
        }
        return result;
    }

    /** Current input buffers; replacing a public field takes effect on the next capture. */
    GetColors()
    {
        return [this.color1, this.color2, this.color3];
    }

    /** Whether inputs need to be considered by the update coordinator. */
    IsDirty()
    {
        return this._dirty;
    }

    /** Acknowledges captured inputs before a prepared binding runs. */
    ClearDirty()
    {
        this._dirty = false;
    }

    /** Marks pending work without changing an effect or scheduling a draw. */
    Rebuild()
    {
        this._dirty = true;
    }

    /**
     * Copies the inputs a target reads, retaining the existing capture shape.
     * @param {PaperDollTarget} target The target being captured.
     * @returns {{option: string, colorAreas: number[], colors: Float32Array[], palette: string}}
     */
    Capture(target = PaperDollTarget.HEAD)
    {
        const option = this.enabled ? this.option : "";
        return {
            option,
            colors: this.GetColors().map(value => Float32Array.from(value)),
            colorAreas: option ? [...this.GetColorAreas()] : [],
            palette: option && !this.customColors ? this.palette : ""
        };
    }

    /** Restores configured inputs; palette conveniences are applied by the UI. */
    Reset()
    {
        this.enabled = true;
        this.option = this._defaultOption;
        this.palette = "";
        this.customColors = false;
        this.color1 = Float32Array.of(.5, .5, .5, 1);
        this.color2 = Float32Array.of(.5, .5, .5, 1);
        this.color3 = Float32Array.of(.5, .5, .5, 1);
        this.Rebuild();
    }

    /** Bake rank among skin layers; null when this part is not a skin layer. */
    static layer = null;

    /** The bake targets these inputs feed, as PaperDollTarget bits. */
    static targets = 0;

    /** Whether a foundation shape edit rebuilds this part while selected. */
    static shapeDependent = false;

    /** Recipe category used by the option table and occlusion ordering. */
    static category = "";

    /** UI hint that selecting an option also selects the palette it names. */
    static optionNamesPalette = false;

    /**
     * Whether a palette also carries specular colours this component's surface target reads; the UI then hands
     * them over with `SetSpecularColors` when it applies a palette.
     */
    static paletteSpecular = false;

    /**
     * Whether the part has a secondary palette (`secondaryPalette`: the areas-2-and-3 swatch of eye shadow and hair),
     * which the UI starts on a second swatch.
     */
    static secondaryPalettes = false;

}
