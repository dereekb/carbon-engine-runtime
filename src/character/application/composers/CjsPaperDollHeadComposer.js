import { PaperDollTarget } from "../paperDollOrder.js";
import { CjsPaperDollComposition } from "./CjsPaperDollComposition.js";

/**
 * A paper doll's head pass, in the composition: two outputs drawn from the parts' sources in the definition's bake
 * order. The head diffuse is the skin pass's head output with every head part's layers over it. The brow target is
 * the brow carrier (the eyebrows' unblended colour and coverage, drawn into the brow's cutout) with the layers of the
 * parts after the eyebrows over it, so what covers the brows on the face covers them on the brow mesh too.
 *
 * Both are the size the foundation's head diffuse gives (`CjsPaperDollComposition.sizeOf`), with mips. The first draw
 * is the definition's own state (`CapturePass`), so the outputs are valid before the first apply.
 *
 * Ours (no Carbon counterpart): Carbon ships no paper doll; the client's is Python. Moved from Graphene's
 * `headComposition.js` (character-structure-and-plugins.md R5); the name is a working name.
 */
export class CjsPaperDollHeadComposer
{

    static className = "CjsPaperDollHeadComposer";

    /** The composition the head's outputs join. @type {CjsPaperDollComposition} */
    composition = null;

    /** The build served: its waits. */
    _build = null;

    /** The head diffuse's base: a copy of the skin pass's head output. @type {object} */
    _copy = null;

    /** The brow target's row. @type {object} */
    _brow = null;

    /**
     * @param {CjsPaperDollComposition} composition The character's composition.
     * @param {{ Ready: function(Promise<*>): Promise<*> }} build The build served.
     */
    constructor(composition, build)
    {
        this.composition = composition;
        this._build = build;
    }

    /**
     * Adds the head diffuse and the brow target and draws both once from the definition's state.
     * @param {import("../CjsPaperDollDefinition.js").CjsPaperDollDefinition} definition The paper doll definition.
     * @param {string} baseMap The foundation's head diffuse map, which sizes the outputs.
     * @param {Array<function(object): void>} consumers What the head diffuse is handed to after each draw.
     * @param {{ base: function(object): object, region: function(object): Float32Array,
     *   consumers: Array<function(object): void> }} brow The brow target: its carrier effect and cutout for a head
     *   capture, and what it is handed to after each draw.
     * @returns {Promise<void>}
     */
    async Prepare(definition, baseMap, consumers, brow)
    {
        const c = this.composition.compositor, base = await this._build.Ready(c.Texture(baseMap));
        const [ width, height ] = CjsPaperDollComposition.sizeOf(base);
        this._copy = await this._build.Ready(c.Copy(base));
        this.composition.AddOutput({
            pass: PaperDollTarget.HEAD, region: "head", channel: "DiffuseMap", width, height, mips: true,
            base: () =>
            {
                this._copy.GetResourceByName("Texture").SetResource(this.composition.GetOutput(PaperDollTarget.SKIN, "head", "DiffuseMap"));
                return this._copy;
            },
            consumers
        });
        this._brow = this.composition.AddOutput({
            pass: PaperDollTarget.HEAD, region: "head", channel: "DiffuseMap", width, height, mips: true,
            base: brow.base, baseRegion: brow.region, after: "eyebrows", consumers: brow.consumers
        });
        this.composition.Render(PaperDollTarget.HEAD, definition.CapturePass(PaperDollTarget.HEAD, definition.GetLayerOrder(PaperDollTarget.HEAD)));
    }

    /**
     * The brow target's texture resource: the target drawn last.
     * @returns {object}
     */
    GetBrowTexture()
    {
        return this._brow.buffers[this._brow.active].resource;
    }

    /**
     * Draws the head's outputs from the head pass's capture and binds them.
     * @param {object} capture The head pass's capture: each part's value by name, and the bake order.
     * @returns {void}
     */
    Apply(capture)
    {
        this.composition.Apply(PaperDollTarget.HEAD, capture);
    }

}
