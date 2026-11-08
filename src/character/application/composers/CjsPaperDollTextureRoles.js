import { CjsPaperDollDefinition } from "../CjsPaperDollDefinition.js";

/** The note on a derived fact: our own earlier code's behaviour, which the screenshots keep. */
const DERIVED = "matches Graphene's working behaviour, today's look (Graphene 6a47517 ";

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
     * method that draws it, or null for an input of another role's operation (`inputOf`). `plan`: `replace` (drawn
     * over what is under it) or `add` (added to it); one part's layers on one property draw replacements first, then
     * additions (character-compositing.md:593, `PlanNormal`). `covered`: drawn through the same option's diffuse
     * coverage when the option has a diffuse. `source`: where each fact is read. `derived`: the facts no source states,
     * which match the working behaviour of our own earlier code (today's look) and wait for a ruling.
     */
    static table = {
        d: {
            families: [ "comp" ],
            property: "DiffuseMap",
            channels: { rgb: "colour", a: "coverage" },
            operation: "Simple",
            plan: "replace",
            covered: false,
            source: "simpleblit: RGB = Texture.rgb, SRC_ALPHA/INV_SRC_ALPHA (character-compositing.md:370, :395); "
                + "DiffuseMap (shaders.yaml partSlots)",
            derived: "its alpha is coverage: " + DERIVED + "augmentations.js:13)"
        },
        l: {
            families: [ "colorize", "comp" ],
            property: "DiffuseMap",
            channels: { rgb: "detail, multiplied by the colour areas", a: "coverage (UseMask 0 keeps the detail's alpha)" },
            operation: "Colorized",
            plan: "replace",
            covered: false,
            source: "colorizedblit D (character-compositing.md:367, :395)",
            derived: "drawn as it is (Simple) without a zone map or palette (CjsPaperDollCompositor.CreateMaterialLayer); "
                + "comp_body_l is a garment detail: " + DERIVED + "bodyComposition.js:74)"
        },
        z: {
            families: [ "colorize" ],
            property: "DiffuseMap",
            channels: { r: "colour area 1 weight", g: "colour area 2 weight", b: "colour area 3 weight", a: "where colourising applies" },
            operation: null,
            inputOf: "l",
            plan: "replace",
            covered: false,
            source: "colorizedblit Z, and the one-channel compact zone decode (character-compositing.md:367, :379-383)"
        },
        n: {
            families: [ "comp" ],
            property: "NormalMap",
            channels: { rgb: "normal (or two-channel: R = X, A = Y, Z rebuilt)" },
            operation: "Simple",
            plan: "replace",
            covered: true,
            source: "covered SimpleBlit replacement (character-compositing.md:593); RGB at 4k, LA at base (:337-338)",
            derived: "the coverage is the option's own diffuse: " + DERIVED
                + "bodyComposition.js:146, hairSupport.js:144, beardSupport.js:67, augmentations.js:14)"
        },
        s: {
            families: [ "comp", "colorize" ],
            property: "SpecularMap",
            channels: { rgba: "specular (LA at base, RGBA in some variations)" },
            operation: "Simple",
            plan: "replace",
            covered: true,
            source: "LA versus RGBA (character-compositing.md:329-330); SpecularMap (shaders.yaml partSlots)",
            derived: "drawn by simpleblit, through the option's diffuse coverage as n; colorize_body_s is a boot's only "
                + "specular: " + DERIVED + "surfaceDetails.js:60, bodyComposition.js:63)"
        },
        tn: {
            families: [ "comp" ],
            property: "NormalMap",
            channels: { rg: "signed XY perturbation, (2 * value - 1) * strength / 2 (two-channel: A gives Y)" },
            operation: "Twist",
            plan: "add",
            covered: false,
            source: "twistnormalblit, two passes ONE/ONE ADD then REV_SUBTRACT, destination alpha kept "
                + "(character-compositing.md:373, :397)"
        },
        mn: {
            families: [ "comp" ],
            property: "NormalMap",
            channels: { rg: "normal XY, Z rebuilt", b: "coverage" },
            operation: "MaskedNormal",
            plan: "replace",
            covered: false,
            source: "maskednormalblit: XY = 2 * rg - 1, alpha = b * strength; SRC_ALPHA/INV_SRC_ALPHA, destination alpha "
                + "kept (character-compositing.md:372, :396)"
        },
        m: {
            families: [ "comp" ],
            property: "CutMaskMap",
            channels: { rgb: "black", a: "where the body is cut" },
            operation: "Simple",
            plan: "replace",
            covered: false,
            source: "black RGB, variable alpha, drawn through alpha onto a white target (character-compositing.md:341-348); "
                + "CutMaskMap (shaders.yaml partSlots)",
            derived: "the white target and a simpleblit: " + DERIVED + "bodyComposition.js:149, :335)"
        }
    };

    /**
     * A texture file's role.
     * @param {string} path The file's `res:` path or name, at any tier.
     * @returns {{ path: string, family: string, region: string, suffix: string, tier: string, property: string,
     *   channels: object, operation: ?string, inputOf?: string, plan: string, covered: boolean, source: string,
     *   derived?: string }}
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

    /**
     * The maps a folder holds directly, one per name at the character texture quality: the composed ones (`comp_` and
     * `colorize_` names) with their roles, and the others, which are not composed maps, by name for the caller to
     * refuse or report (`aa_female_head_s` in eyeshadow_02). A composed name the lookup does not source throws.
     * @param {string} folder The folder's `res:` path, ending in "/".
     * @param {string[]} files The listed files.
     * @returns {{ roles: Array<ReturnType<typeof CjsPaperDollTextureRoles.lookup>>, skipped: string[] }} The composed
     *   maps' roles, and the other map names.
     * @throws {Error} For a composed map name the lookup does not source.
     */
    static readFolder(folder, files)
    {
        const maps = files.filter(file => file.startsWith(folder) && file.lastIndexOf("/") === folder.length - 1 && file.endsWith(".png"));
        const names = [ ...new Set(maps.map(file => CjsPaperDollDefinition.splitTier(file)[0])) ];
        const composed = names.filter(stem => /^(comp|colorize)_/u.test(stem.slice(folder.length)));
        return {
            roles: composed.map(stem => CjsPaperDollTextureRoles.lookup(CjsPaperDollDefinition.pickTier(stem + ".png", maps))),
            skipped: names.filter(stem => !composed.includes(stem)).map(stem => stem.slice(folder.length))
        };
    }

    /**
     * The one map among roles that matches, or null.
     * @param {Array<ReturnType<typeof CjsPaperDollTextureRoles.lookup>>} roles The maps' roles.
     * @param {function(object): boolean} match The test.
     * @returns {?ReturnType<typeof CjsPaperDollTextureRoles.lookup>}
     * @throws {Error} For more than one match.
     */
    static one(roles, match)
    {
        const found = roles.filter(match);
        if (found.length > 1) throw new Error("Ambiguous paper doll maps " + found.map(role => role.path).join(", "));
        return found[0] ?? null;
    }

}
