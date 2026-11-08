import { PaperDollPass } from "../paperDollOrder.js";
import { CjsPaperDollComposition } from "./CjsPaperDollComposition.js";

/** The surface outputs' channels, as the consumer effects name them. */
const CHANNELS = [ "NormalMap", "SpecularMap" ];

/**
 * A paper doll's surface pass, in the composition: the head and body normal and specular maps, each based on the
 * selected foundation's own map, with mips. The parts give their layers through their sources on the composition:
 * the map-decal parts' (`CjsPaperDollMapDecalSource.prepareAll`: aging, scarring, scars) and the others' (lipstick,
 * garments, augmentations, hair, beard).
 *
 * Ours (no Carbon counterpart): Carbon ships no paper doll; the client's is Python. Moved from Graphene's
 * `surfaceDetails.js` (character-structure-and-plugins.md R5); the name is a working name.
 */
export class CjsPaperDollSurfaceComposer
{

    static className = "CjsPaperDollSurfaceComposer";

    /** The composition the surface's outputs join. @type {CjsPaperDollComposition} */
    composition = null;

    /** The build served: its waits, its report (`report.surfaceDetails`) and its content root. */
    _build = null;

    /** The definition whose foundation selects the bases. */
    _definition = null;

    /** Each foundation's copied head and body normal and specular maps, by foundation id. @type {Map<string, object>} */
    _bases = new Map();

    /** The map-decal parts' sources, by part name. @type {Map<string, import("./CjsPaperDollMapDecalSource.js").CjsPaperDollMapDecalSource>} */
    _decals = new Map();

    /** Notes a change, for the build's log. @type {function(string): void} */
    _onChange = null;

    /**
     * @param {CjsPaperDollComposition} composition The character's composition.
     * @param {{ Ready: function(Promise<*>): Promise<*>, report: object, content: { root: string } }} build The build served.
     */
    constructor(composition, build)
    {
        this.composition = composition;
        this._build = build;
    }

    /**
     * Copies every prepared foundation's bases, configures the map-decal parts and adds their sources, and adds the
     * four outputs. Nothing is drawn until the first apply.
     * @param {import("../CjsPaperDollDefinition.js").CjsPaperDollDefinition} definition The paper doll definition.
     * @param {Map<string, object>} foundations The foundations prepared so far, by id; another joins with `PrepareFoundation`.
     * @param {{ head: object[], body: object[] }} consumers The effects each region's maps bind to; read at each bind,
     *   so effects added later (garments, the drape) take the maps too.
     * @param {function(string): void} onChange Notes a change.
     * @param {Map<string, import("./CjsPaperDollMapDecalSource.js").CjsPaperDollMapDecalSource>} decals The map-decal parts' sources, for the build report.
     * @returns {Promise<void>}
     */
    async Prepare(definition, foundations, consumers, onChange, decals)
    {
        this._definition = definition;
        this._onChange = onChange;
        const sizes = {};
        for (const [ id, foundation ] of foundations) Object.assign(sizes, await this.PrepareFoundation(id, foundation));

        this._decals = decals;

        for (const region of [ "head", "body" ]) for (const channel of CHANNELS)
        {
            const [ width, height ] = sizes[region + "." + channel];
            this.composition.AddOutput({
                pass: PaperDollPass.SURFACE, region, channel, width, height, mips: true,
                base: () => this._bases.get(this._definition.archetype.option)[region][channel],
                consumers: [ resource => { for (const effect of consumers[region]) effect.GetResourceByName(channel).SetResource(resource); } ]
            });
        }

        this._build.report.surfaceDetails = {
            order: definition.GetLayerOrder(PaperDollPass.SURFACE),
            orderAuthority: "the paper doll bake order (PaperDollLayer)",
            options: Object.fromEntries([ ...this._decals ].map(([ name, source ]) => [ name, source.Describe() ])),
            updates: 0
        };
    }

    /**
     * Copies one foundation's head and body normal and specular maps, the bases the details draw over; once per foundation.
     * @param {string} id The foundation's id.
     * @param {object} foundation The prepared foundation.
     * @returns {Promise<Record<string, [number, number]>>} Each map's output size, by `region.channel`
     *   (CjsPaperDollComposition.sizeOf).
     */
    async PrepareFoundation(id, foundation)
    {
        const c = this.composition.compositor, regions = {}, sizes = {};
        if (this._bases.has(id)) return sizes;
        for (const region of [ "head", "body" ])
        {
            regions[region] = {};
            for (const channel of CHANNELS)
            {
                const texture = await c.Texture(foundation.bindings[region][channel]);
                sizes[region + "." + channel] = CjsPaperDollComposition.sizeOf(texture);
                regions[region][channel] = await c.Copy(texture);
            }
        }
        this._bases.set(id, regions);
        return sizes;
    }

    /**
     * The pass's binding (`CjsPaperDollInstance`'s `surface`): draws the captured surface and binds the four maps.
     * @param {object} pass The surface pass's capture.
     * @returns {void}
     */
    Apply(pass)
    {
        this.composition.Apply(PaperDollPass.SURFACE, pass);
        const report = this._build.report.surfaceDetails;
        // Options prepared since Prepare (each loads on first apply) join the report.
        report.options = Object.fromEntries([ ...this._decals ].map(([ name, source ]) => [ name, source.Describe() ]));
        report.selected = { scars: pass.scars.option, aging: pass.aging.option, scarring: pass.scarring.option };
        report.updates++;
        this._onChange("surface details applied");
    }

}
