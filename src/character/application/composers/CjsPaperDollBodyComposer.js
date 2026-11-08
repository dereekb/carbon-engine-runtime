import { CjsPaperDollInstance } from "../CjsPaperDollInstance.js";
import { CjsPaperDollCompositor } from "../compositor/CjsPaperDollCompositor.js";
import { PaperDollTarget } from "../paperDollOrder.js";
import { CjsPaperDollComposition } from "./CjsPaperDollComposition.js";

/**
 * A paper doll's body target, in the composition: two outputs drawn from the parts' sources in the definition's bake
 * order. The body diffuse is the skin target's body output with every body part's layers over it (freckles, face
 * augmentations' body maps, garments). The cut mask starts white (the body shows everywhere: the content's default
 * body mask, `genericfembody_m`, is white) and each drawn part's `CutMaskMap` layers cut it, so the masks of a part
 * the paper doll does not hand over (suppressed, or without an option) do not cut.
 *
 * Both are the size the foundation's body diffuse gives (`CjsPaperDollComposition.sizeOf`), with mips. The first draw
 * is the definition's own state (`CjsPaperDollInstance.ready`), so the outputs are valid before the first apply.
 *
 * Moved from Graphene's `bodyComposition.js` without a change of look, which rests on two content facts (resource index
 * of build 3670638, every face augmentation and freckles option on both sexes, the variation folder over the part
 * folder): each has at most one body diffuse map (`comp_body_d` or a `_l` detail), so drawing every body DiffuseMap
 * layer equals the old first-layer pick; and none holds a cut mask (`comp_*_m`), so their sources add nothing to the
 * cut mask.
 *
 * Ours (no Carbon counterpart): Carbon ships no paper doll; the client's is Python. Moved from Graphene's
 * `bodyComposition.js` (character-structure-and-plugins.md R5); the name is a working name.
 */
export class CjsPaperDollBodyComposer
{

    static className = "CjsPaperDollBodyComposer";

    /** The composition the body's outputs join. @type {CjsPaperDollComposition} */
    composition = null;

    /** The outputs' width, from the foundation's body diffuse. */
    width = 0;

    /** The outputs' height. */
    height = 0;

    /** The build served: its waits. */
    _build = null;

    /** The body diffuse's base: a copy of the skin target's body output. @type {object} */
    _copy = null;

    /** The cut mask's base: white over the whole target. @type {object} */
    _white = null;

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
     * Adds the body diffuse and the cut mask and draws both once from the definition's state.
     * @param {import("../CjsPaperDollDefinition.js").CjsPaperDollDefinition} definition The paper doll definition.
     * @param {string} baseMap The foundation's body diffuse map, which sizes the outputs.
     * @param {Array<function(object): void>} consumers What the body diffuse is handed to after each draw.
     * @param {Array<function(object): void>} cutMaskConsumers What the cut mask is handed to after each draw.
     * @returns {Promise<void>}
     */
    async Prepare(definition, baseMap, consumers, cutMaskConsumers)
    {
        const c = this.composition.compositor, base = await this._build.Ready(c.Texture(baseMap));
        [ this.width, this.height ] = CjsPaperDollComposition.sizeOf(base);
        this._copy = await this._build.Ready(c.Copy(base));
        this._white = await this._build.Ready(c.Simple(await this._build.Ready(c.Texture("dynamic:/color/1,1,1,1")), CjsPaperDollCompositor.full));
        this.composition.AddOutput({
            target: PaperDollTarget.BODY, region: "body", channel: "DiffuseMap", width: this.width, height: this.height, mips: true,
            base: () =>
            {
                this._copy.GetResourceByName("Texture").SetResource(this.composition.GetOutput(PaperDollTarget.SKIN, "body", "DiffuseMap"));
                return this._copy;
            },
            consumers
        });
        this.composition.AddOutput({
            target: PaperDollTarget.BODY, region: "body", channel: "CutMaskMap", width: this.width, height: this.height, mips: true,
            base: () => this._white, consumers: cutMaskConsumers
        });
        this.composition.Render(PaperDollTarget.BODY, CjsPaperDollInstance.ready(definition, PaperDollTarget.BODY));
    }

    /**
     * Draws the body's outputs from the body target's capture and binds them.
     * @param {object} capture The body target's capture: each part's value by name, and the bake order.
     * @returns {void}
     */
    Apply(capture)
    {
        this.composition.Apply(PaperDollTarget.BODY, capture);
    }

}
