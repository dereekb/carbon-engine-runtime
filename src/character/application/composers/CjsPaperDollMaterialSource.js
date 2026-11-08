import { blue } from "#blue";
import { CjsPaperDollCompositor } from "../compositor/CjsPaperDollCompositor.js";
import { CjsPaperDollDefinition } from "../CjsPaperDollDefinition.js";
import { PaperDollBlend, PaperDollTarget } from "../paperDollOrder.js";
import { CjsPaperDollColorizedSource } from "./CjsPaperDollColorizedSource.js";
import { CjsPaperDollTextureRoles } from "./CjsPaperDollTextureRoles.js";

/**
 * The layer source of a garment (`static blend` MATERIAL with the body target: underwear, body augmentations, arms,
 * middles, outers, feet). Each selected option draws its material layer (`CjsPaperDollCompositor.CreateMaterialLayer`)
 * into the body: its diffuse (the detail colourised through its zone map in the captured colours, or an authored
 * diffuse drawn as it is) and its body cut masks; and into the surface, under its coverage, a flat normal and a black
 * specular first, then its own normal and specular. Its maps are named by `CjsPaperDollTextureRoles.garment`.
 *
 * Options, from the part's folder (`static category`): one per first-level folder for the underwear
 * (`static optionPerFolder`; each folder holds one `.type` per bloodline that wears it), else one per `.type`.
 * Palettes: the `.color` files directly in the option's first-level folder (`PaperDollPalettes.OWN`). An option's
 * `.type` names its variation (a subfolder holding its maps, ahead of the part folder's) and colour variant (its
 * default palette); its metadata (the first folder's `metadata.yaml`) its dependants, what it occludes and its colour
 * areas (`numColorAreas`, else read from the zone map). Each option reads its files when first applied, and its maps
 * load when first drawn; until then it draws nothing, and `MapsWaiting` says it is owed.
 *
 * Moved from Graphene's `bodyComposition.js` (d2b1306) without a change of look; the rules above are its rules,
 * derived (today's look). Derived and our own default, awaiting the defaults work: the underwear starts on the garment
 * typed for the foundation's bloodline, else the first; the other garments start off. A loaded recipe's garments are
 * not applied yet (today's look; the rule that a recipe applies what it sets waits for the defaults work).
 *
 * The mesh facts (model, utility shapes, promoted dependency shapes) are the host's until the instance owns meshes
 * (R6): `SetResolveHook` installs what reads them when an option resolves.
 *
 * Ours (no Carbon counterpart): Carbon ships no paper doll; the client's is Python. The name is a working name.
 */
export class CjsPaperDollMaterialSource
{

    static className = "CjsPaperDollMaterialSource";

    /** The definition part this source serves. */
    name = "";

    /** The compositor its layers are made with. @type {CjsPaperDollCompositor} */
    _compositor = null;

    /** The build served: its waits, content, cancellation (`closed`), notes and errors. */
    _build = null;

    /** The definition, rebuilt when an option's maps land. */
    _definition = null;

    /** Each option, by id. @type {Map<string, object>} */
    _options = new Map();

    /** The host's mesh-fact reader, or null. @type {?function(string, object): Promise<void>} */
    _hook = null;

    /**
     * @param {CjsPaperDollCompositor} compositor The compositor its layers are made with.
     * @param {object} build The build served.
     * @param {string} name The definition part.
     */
    constructor(compositor, build, name)
    {
        this._compositor = compositor;
        this._build = build;
        this.name = name;
    }

    /**
     * A source for every garment part (`static blend` MATERIAL with the body target), each configured and set on the
     * composition.
     * @param {import("./CjsPaperDollComposition.js").CjsPaperDollComposition} composition The composition.
     * @param {import("../CjsPaperDollDefinition.js").CjsPaperDollDefinition} definition The paper doll definition.
     * @param {object} build The build served.
     * @returns {Promise<Map<string, CjsPaperDollMaterialSource>>} The sources, by part.
     */
    static async prepareAll(composition, definition, build)
    {
        const sources = new Map();
        for (const name of CjsPaperDollDefinition.parts)
        {
            const type = definition[name].constructor;
            if (type.blend !== PaperDollBlend.MATERIAL || !(type.targets & PaperDollTarget.BODY)) continue;
            const source = new CjsPaperDollMaterialSource(composition.compositor, build, name);
            source.Configure(definition);
            composition.SetSource(name, source);
            sources.set(name, source);
        }
        return sources;
    }

    /**
     * Lists the part's options from the file index alone and configures the definition's component with them.
     * @param {import("../CjsPaperDollDefinition.js").CjsPaperDollDefinition} definition The paper doll definition.
     * @returns {void}
     * @throws {Error} For an underwear folder without a palette.
     */
    Configure(definition)
    {
        const component = definition[this.name], type = component.constructor, ROOT = this._build.content.root;
        const root = ROOT + type.category + "/", files = CjsPaperDollDefinition.listFiles(root);
        this._definition = definition;
        // Palettes: every .color file directly inside a first-level folder.
        const colorFiles = files.filter(path => path.endsWith(".color") && path.lastIndexOf("/") === path.indexOf("/", root.length));
        const recordsOf = dir => colorFiles.filter(path => path.startsWith(dir)).map(path => CjsPaperDollColorizedSource.record(path));
        const option = (id, base, typePath, bloodlines) => ({ id, base, type: typePath, files, colorFiles, records: recordsOf(base), bloodlines,
            path: typePath ? base.slice(ROOT.length, -1) : type.category + "/" + id, resolved: null, maps: null });
        if (type.optionPerFolder)
        {
            for (const dir of [ ...new Set(files.map(path => path.slice(0, path.indexOf("/", root.length) + 1))) ])
            {
                const id = dir.slice(root.length, -1);
                // The bloodlines that wear it, from its `types/<name>_<bloodline>.type` file names.
                const bloodlines = files.filter(path => path.startsWith(dir + "types/") && path.endsWith(".type")).map(path => path.slice(path.lastIndexOf("_") + 1, -".type".length));
                const value = option(id, dir, null, bloodlines);
                if (!value.records.length) throw new Error("Underwear without a palette " + dir);
                this._options.set(id, value);
            }
        }
        else for (const typePath of files.filter(path => path.endsWith(".type")))
        {
            // A type's part is the folder its `types/` folder sits in (true of every garment type in the content).
            const base = typePath.slice(0, typePath.indexOf("/types/") + 1), id = typePath.slice(typePath.lastIndexOf("/") + 1, -".type".length);
            this._options.set(id, option(id, base, typePath, []));
        }
        const archetype = definition.archetype, bloodline = (archetype.GetOptions().find(value => value.id === archetype.option)?.label ?? "").split(" ").at(-1).toLowerCase();
        const values = [ ...this._options.values() ];
        const selected = type.optionPerFolder ? values.find(value => value.bloodlines.includes(bloodline)) ?? values[0] ?? null : null;
        component.Configure(values.map(value => ({ id: value.id, path: value.path, palettes: [] })), new Map(), {
            option: selected ? selected.id : "",
            resolve: id => this._Resolve(this._options.get(id))
        });
        if (!selected) component.enabled = false;
    }

    /**
     * Installs the host's mesh-fact reader, awaited as each option resolves (see the class).
     * @param {function(string, object): Promise<void>} hook Called with the part and the resolved option.
     * @returns {void}
     */
    SetResolveHook(hook)
    {
        this._hook = hook;
    }

    /**
     * Reads one option's files the first time it is applied: its `.type` (variation and colour variant), its metadata
     * (dependants, occludes, colour areas) and, through the host's hook, its mesh facts.
     * @param {object} option The option.
     * @returns {Promise<object>} The component option's resolved fields.
     * @throws {Error} For a `.type` that is not three strings.
     */
    async _Resolve(option)
    {
        const build = this._build, c = this._compositor, { files, colorFiles, base, records } = option;
        let folders = [ base ], variation = "", defaultPalette = records[0]?.path ?? null;
        if (option.type)
        {
            const [ path, typeVariation = "", colorVariant = "" ] = (await build.Ready(blue.characterLibrary.FetchType(option.type))).value;
            if (typeof path !== "string" || typeof typeVariation !== "string" || typeof colorVariant !== "string") throw new Error("Unsupported augmentation type " + option.type);
            variation = typeVariation;
            if (colorVariant && colorFiles.includes(base + colorVariant + ".color")) defaultPalette = base + colorVariant + ".color";
            // A variation without its own folder (v0) is the part's folder itself; the variation's folder first, then the part's.
            const maps = variation && files.some(file => file.startsWith(base + variation + "/")) ? base + variation + "/" : base;
            folders = [ ...new Set([ maps, base ]) ];
        }
        else defaultPalette = (records.find(record => record.path.endsWith("/default.color")) ?? records[0]).path;
        // The first folder's metadata: dependants and occludes, each entry cut to its path; its colour areas.
        const metadataPath = folders.map(folder => folder + "metadata.yaml").find(path => files.includes(path)) ?? null;
        const metadata = metadataPath ? await build.Ready(blue.characterLibrary.FetchAvatarPartMetaData(metadataPath)) : null;
        const list = key => metadata ? [ ...new Set(metadata[key].map(value => value.split("#")[0])) ] : [];
        const dependants = list("dependantModifiers"), occludes = list("occludesModifiers");
        const maps = CjsPaperDollTextureRoles.pickGarmentMaps(folders, files);
        let colorAreas = [];
        if (maps.detail && maps.zone && defaultPalette)
        {
            const count = metadata ? metadata.numColorAreas : -1;
            colorAreas = count < 0
                ? await build.Ready(c.ColorAreas(await build.Ready(c.Texture(maps.detail)), await build.Ready(c.Texture(maps.zone))))
                : Array.from({ length: count }, (_, index) => index + 1);
        }
        const resolved = { id: option.id, path: option.path, type: option.type, base, folders, variation, files, dependants, occludes, defaultPalette, maps };
        if (this._hook !== null) await this._hook(this.name, resolved);
        // Drawn from here on: the maps load on the next draw.
        option.resolved = resolved;
        return {
            occludes,
            colorAreas,
            defaultPalette: colorAreas.length ? defaultPalette : undefined,
            palettes: colorAreas.length ? records : []
        };
    }

    /**
     * An option's material layer once loaded; starts the load when the option is resolved and its maps are not, and
     * rebuilds the definition when it lands. Null until then, and after a failed load (reported once).
     * @param {object} option The option.
     * @returns {?object}
     */
    _Maps(option)
    {
        if (option.resolved === null) return null;
        option.maps ??= { state: "idle", value: null };
        const maps = option.maps;
        if (maps.state === "idle")
        {
            maps.state = "loading";
            this._LoadMaps(option).then(value =>
            {
                Object.assign(maps, { state: "ready", value });
                this._definition.Rebuild();
            }).catch(error =>
            {
                // A load cut short because the character closed begins again when next asked.
                if (this._build.closed) { maps.state = "idle"; return; }
                maps.state = "failed";
                this._build.Error("garment " + option.id + ": " + error.message);
                this._build.Note("garment " + option.id + " failed: " + error.message);
            });
        }
        return maps.value;
    }

    /**
     * Loads an option's maps and palettes and makes its material layer, its cut masks (its own, then each dependant
     * folder's, `maskPaths`) and the clears drawn under its coverage.
     * @param {object} option The option.
     * @returns {Promise<object>} The material layer, with `masks` and `clear`.
     * @throws {Error} For an option without a detail map.
     */
    async _LoadMaps(option)
    {
        const build = this._build, c = this._compositor, crop = CjsPaperDollCompositor.crop, { folders, files, defaultPalette, dependants, maps } = option.resolved;
        if (!maps.detail) throw new Error("Garment without a detail map " + folders[0]);
        // The default's colours, and which palettes are patterned (composed through patternblit).
        const paths = option.records.map(record => record.path), reads = [ ...new Set([ ...(defaultPalette ? [ defaultPalette ] : []), ...paths ]) ];
        const [ detail, zones, normal, specular, ...read ] = await Promise.all([
            ...[ maps.detail, maps.zone, maps.normal, maps.specular ].map(path => path ? build.Ready(c.Texture(path)) : null),
            ...reads.map(path => build.Ready(blue.characterLibrary.FetchPalette(path)))
        ]);
        const palette = defaultPalette ? read[reads.indexOf(defaultPalette)].colors : null;
        const patterns = new Map(reads.map((path, index) => [ path, read[index].pattern ]).filter(([ path, pattern ]) => pattern && paths.includes(path)));
        const [ flatNormal, noSpecular ] = await Promise.all([ "0.5,0.5,1,1", "0,0,0,1" ].map(color => build.Ready(c.Texture("dynamic:/color/" + color))));
        const masks = this._MaskPaths(option);
        const layer = await c.CreateMaterialLayer({ detail, zones, normal, specular }, palette, { coverage: true, patterns });
        return Object.assign(layer, {
            masks: await Promise.all(masks.map(async path =>
            {
                const texture = await build.Ready(c.Texture(path));
                return { effect: await c.Simple(texture, crop(texture)), region: crop(texture), path };
            })),
            clear: {
                NormalMap: { effect: await c.Simple(flatNormal, crop(detail), detail, crop(detail)), region: crop(detail) },
                SpecularMap: { effect: await c.Simple(noSpecular, crop(detail), detail, crop(detail)), region: crop(detail) }
            },
            skipped: CjsPaperDollTextureRoles.garmentSkipped(folders, files, [ ...Object.values(maps) ])
        });
    }

    /**
     * An option's body cut masks: its own folders' first, then each dependant folder's (a boot's
     * `dependants/bootmasks/*`, a top's `dependants/masktuck/*`); utility shapes are not folders.
     * @param {object} option The option.
     * @returns {string[]} The mask paths.
     */
    _MaskPaths(option)
    {
        const ROOT = this._build.content.root, { maps, dependants } = option.resolved;
        const fromDependants = dependants.filter(path => !/^utilityshapes\//iu.test(path)).map(path =>
        {
            const dir = ROOT + path.toLowerCase() + "/";
            return CjsPaperDollTextureRoles.pickGarmentMaps([ dir ], CjsPaperDollDefinition.listFiles(dir)).cutMask;
        });
        return [ ...new Set([ maps.cutMask, ...fromDependants ].filter(Boolean)) ];
    }

    /**
     * The captured option's layers: its diffuse and cut masks into the body, and into the surface its coverage clears
     * then its normal or specular; none elsewhere, for no option, or while it resolves or its maps load.
     * @param {{ option: string, colors: Float32Array[] }} value The part's capture.
     * @param {string} region The output's region.
     * @param {string} channel The output's channel.
     * @returns {Array<{ effect: object, region: Float32Array }>}
     */
    GetLayers(value, region, channel)
    {
        if (region !== "body" || !value.option) return [];
        const option = this._options.get(value.option);
        const layer = option === undefined ? null : this._Maps(option);
        if (layer === null) return [];
        if (channel === "DiffuseMap") return [ { effect: layer.DiffuseFor(value), region: layer.DiffuseMap.region } ];
        if (channel === "CutMaskMap") return layer.masks.map(mask => ({ effect: mask.effect, region: mask.region }));
        if (channel !== "NormalMap" && channel !== "SpecularMap") return [];
        // Under the garment's cutout, the layers below are cleared first.
        return layer[channel] ? [ layer.clear[channel], layer[channel] ] : [ layer.clear[channel] ];
    }

    /**
     * The captured option's colourised diffuse and its region, once its maps are loaded; null before. The host's drape
     * (a mesh: R6) draws it.
     * @param {{ option: string, colors: Float32Array[] }} value The part's capture.
     * @returns {?{ effect: object, region: Float32Array }}
     */
    GetDiffuse(value)
    {
        const option = value.option ? this._options.get(value.option) : undefined;
        const layer = option === undefined ? null : this._Maps(option);
        return layer === null ? null : { effect: layer.DiffuseFor(value), region: layer.DiffuseMap.region };
    }

    /**
     * The cut mask paths a captured option draws, once its maps are loaded, for the build report.
     * @param {{ option: string }} value The part's capture.
     * @returns {string[]}
     */
    GetCutMaskPaths(value)
    {
        const option = value.option ? this._options.get(value.option) : undefined;
        const layer = option === undefined || option.maps === null ? null : option.maps.value;
        return layer === null ? [] : layer.masks.map(mask => mask.path);
    }

    /**
     * An option's resolved record (folders, variation, dependants, occludes, maps), or null before it resolves.
     * @param {string} id The option.
     * @returns {?object}
     */
    GetResolved(id)
    {
        const option = this._options.get(id);
        return option === undefined ? null : option.resolved;
    }

    /**
     * Whether a resolved option's maps are still owed (starting their load): idle or loading. A failed load does not
     * wait.
     * @param {string} id The option.
     * @returns {boolean}
     */
    MapsWaiting(id)
    {
        const option = this._options.get(id);
        if (option === undefined || option.resolved === null) return false;
        return this._Maps(option) === null && (option.maps.state === "idle" || option.maps.state === "loading");
    }

    /**
     * The loaded options, for the build report: each option's maps and the map names in its folders it does not draw.
     * @returns {object[]}
     */
    Describe()
    {
        return [ ...this._options.values() ].filter(option => option.maps !== null && option.maps.value !== null)
            .map(option => ({ id: option.id, maps: option.resolved.maps, skipped: option.maps.value.skipped }));
    }

}
