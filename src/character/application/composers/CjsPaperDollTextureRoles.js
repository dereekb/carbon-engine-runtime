import { CjsPaperDollDefinition } from "../CjsPaperDollDefinition.js";

/**
 * What a paper doll texture file is, from its name: `<family>_<region>_<suffix>[<tier>].png`. Every composer reads
 * texture roles here, never from a per-part table: give it a file and it returns the region, the suffix, the effect
 * property the composed map feeds, what each channel of the file holds and the compositor operation that draws it.
 * A name outside the table throws; nothing is guessed.
 *
 * Sources, cited per entry:
 * - Property names: the character effects' texture parameters, `src/character/discovery/shaders.yaml` (DiffuseMap,
 *   NormalMap, SpecularMap and CutMaskMap are the same names in every character effect that samples them; the fur
 *   shells bind `colorize_head_l` directly as `LengthTexture`, :1024, which is mesh binding, not composition).
 * - Channels and blends: the shipped compositing effects, `docs/research/character-compositing.md` (:307-347
 *   per-channel placement, :349-405 blit arithmetic and states).
 * - Families, regions and suffixes: the file names under `res:/graphics/character/<sex>/paperdoll/` (resource
 *   index, build 3670638): families `comp` and `colorize`; regions `head`, `body`, `hair`, `acc`; tiers `_4k`,
 *   `_512`, `_256` and none (`CjsPaperDollDefinition.splitTier`).
 *
 * Ours (no Carbon counterpart): Carbon ships no paper doll; the client's is Python. The name is a working name.
 */
export class CjsPaperDollTextureRoles
{

    static className = "CjsPaperDollTextureRoles";

    /** The regions a file name can carry, as authored. */
    static regions = [ "head", "body", "hair", "acc" ];

    /**
     * Each suffix's role. `families`: the name prefixes it is sourced for. `property`: the effect texture parameter
     * the composed map feeds. `channels`: what the file's channels hold. `operation`: the `CjsPaperDollCompositor`
     * method that draws it, or null for an input of another role's operation (`inputOf`). `covered`: drawn through
     * the same option's diffuse coverage when the option has a diffuse. `source`: where each fact is read.
     */
    static table = {
        d: {
            families: [ "comp" ],
            property: "DiffuseMap",
            channels: { rgb: "colour", a: "coverage" },
            operation: "Simple",
            covered: false,
            source: "simpleblit: RGB = Texture.rgb, SRC_ALPHA/INV_SRC_ALPHA (character-compositing.md:370, :395); "
                + "DiffuseMap (shaders.yaml partSlots); painted through its own alpha (Graphene 6a47517 augmentations.js:13)"
        },
        l: {
            families: [ "colorize", "comp" ],
            property: "DiffuseMap",
            channels: { rgb: "detail, multiplied by the colour areas", a: "coverage (UseMask 0 keeps the detail's alpha)" },
            operation: "Colorized",
            covered: false,
            source: "colorizedblit D (character-compositing.md:367, :395); drawn as it is (Simple) without a zone map or "
                + "palette (CjsPaperDollCompositor.CreateMaterialLayer); comp_body_l is a garment detail (Graphene 6a47517 bodyComposition.js:74)"
        },
        z: {
            families: [ "colorize" ],
            property: "DiffuseMap",
            channels: { r: "colour area 1 weight", g: "colour area 2 weight", b: "colour area 3 weight", a: "where colourising applies" },
            operation: null,
            inputOf: "l",
            covered: false,
            source: "colorizedblit Z, and the one-channel compact zone decode (character-compositing.md:367, :379-383)"
        },
        n: {
            families: [ "comp" ],
            property: "NormalMap",
            channels: { rgb: "normal (or two-channel: R = X, A = Y, Z rebuilt)" },
            operation: "Simple",
            covered: true,
            source: "covered SimpleBlit replacement (character-compositing.md:593); RGB at 4k, LA at base (:337-338); "
                + "drawn through the detail's coverage (CjsPaperDollCompositor.CreateMaterialLayer coverage; Graphene 6a47517 "
                + "bodyComposition.js:146, hairSupport.js:144, beardSupport.js:67, augmentations.js:14)"
        },
        s: {
            families: [ "comp", "colorize" ],
            property: "SpecularMap",
            channels: { rgba: "specular (LA at base, RGBA in some variations)" },
            operation: "Simple",
            covered: true,
            source: "simpleblit (Graphene 6a47517 surfaceDetails.js:60); LA versus RGBA (character-compositing.md:329-330); "
                + "drawn through the detail's coverage as n; colorize_body_s is a boot's only specular (bodyComposition.js:63)"
        },
        tn: {
            families: [ "comp" ],
            property: "NormalMap",
            channels: { rg: "signed XY perturbation, (2 * value - 1) * strength / 2 (two-channel: A gives Y)" },
            operation: "Twist",
            covered: false,
            source: "twistnormalblit, two passes ONE/ONE ADD then REV_SUBTRACT, destination alpha kept "
                + "(character-compositing.md:373, :397); Graphene 6a47517 surfaceDetails.js:60"
        },
        mn: {
            families: [ "comp" ],
            property: "NormalMap",
            channels: { rg: "normal XY, Z rebuilt", b: "coverage" },
            operation: "MaskedNormal",
            covered: false,
            source: "maskednormalblit: XY = 2 * rg - 1, alpha = b * strength; SRC_ALPHA/INV_SRC_ALPHA, destination alpha "
                + "kept (character-compositing.md:372, :396); Graphene 6a47517 largeScars.js:38"
        },
        m: {
            families: [ "comp" ],
            property: "CutMaskMap",
            channels: { rgb: "black", a: "where the body is cut" },
            operation: "Simple",
            covered: false,
            source: "black RGB, variable alpha, drawn through alpha onto a white target (character-compositing.md:341-348; "
                + "Graphene 6a47517 bodyComposition.js:149, :335); CutMaskMap (shaders.yaml partSlots)"
        }
    };

    /**
     * A texture file's role.
     * @param {string} path The file's `res:` path or name, at any tier.
     * @returns {{ path: string, family: string, region: string, suffix: string, tier: string, property: string,
     *   channels: object, operation: ?string, inputOf?: string, covered: boolean, source: string }}
     * @throws {Error} For a name outside `<family>_<region>_<suffix>[<tier>].png`, or a suffix the table does not
     *   source for that family.
     */
    static lookup(path)
    {
        if (!path.endsWith(".png")) throw new Error("Not a paper doll texture name: " + path);
        const [ stem, tier ] = CjsPaperDollDefinition.splitTier(path);
        const match = /^(comp|colorize)_([a-z]+)_([a-z]+)$/u.exec(stem.split("/").at(-1));
        if (!match) throw new Error("Not a paper doll texture name: " + path);
        const [ , family, region, suffix ] = match;
        if (!CjsPaperDollTextureRoles.regions.includes(region)) throw new Error("Unknown paper doll texture region " + region + ": " + path);
        const role = CjsPaperDollTextureRoles.table[suffix];
        if (!role || !role.families.includes(family)) throw new Error("Unknown paper doll texture role " + family + "_" + suffix + ": " + path);
        return { path, family, region, suffix, tier, ...role };
    }

}
