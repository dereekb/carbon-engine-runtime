/**
 * Bake order of the paper doll's skin layers: each part class stamps its rank
 * as `static layer`, and the doll composes a pass's layers in ascending rank.
 *
 * This is the composition order, not the recipe category order
 * (`CjsCharacterModifierOrder`), which files parts by where they are stored.
 * The ranks are confirmed against the game. They are spaced so a layer can be placed between two others without
 * renumbering.
 *
 * @readonly
 * @enum {number}
 */
export const PaperDollLayer = Object.freeze({
    /** The base skin colour every other layer is drawn over. */
    SKINTONE: 0,
    /** A base layer: wrinkles and relief under all cosmetics. */
    AGING: 10,
    TATTOO: 30,
    EYEBROWS: 40,
    SCARRING: 50,
    FRECKLES: 60,
    BLUSH: 70,
    EYESHADOW: 90,
    /** Facial hair over the other skin detail, adjacent to scalp hair. Working rank, to confirm in game. */
    BEARD: 96,
    EYELINER: 100,
    LIPSTICK: 110,
    /** Over the lipstick and before every garment. */
    AUGMENTATIONS: 112,
    /** The hair painted on the scalp, over the face augmentations. */
    HAIR: 113,
    /** Body augmentations: with the face ones, before every garment. */
    BODYAUGMENTATION: 114,
    ARMLEFT: 116,
    ARMRIGHT: 118,
    SCARS: 120,
    /** Accessories (glasses, piercings, masks): meshes with their own maps, drawn with the head pass. */
    ACCESSORIES: 125,
    /** Body: over the skin and its freckles; the bra goes over the underpants. */
    BOTTOMUNDERWEAR: 130,
    TOPUNDERWEAR: 140,
    /** Baked garments over the underwear: tights, then the top over them. */
    BOTTOMMIDDLE: 150,
    TOPMIDDLE: 160,
    /** Trousers and skirts, over the top: the top tucked in. */
    BOTTOMOUTER: 170,
    /** Shoes and boots, over the bottoms: trousers tucked into boots. */
    FEET: 180,
    /** Over-tops (topouter), then outer garments (jackets, suits, robes), over everything else. */
    TOPOUTER: 190,
    OUTER: 200
});

/**
 * The doll's update passes, as bits: a part class declares the passes its
 * settings feed as `static passes`. Each pass has its own binding.
 *
 * @readonly
 * @enum {number}
 */
export const PaperDollPass = Object.freeze({
    /** The archetype's resolved foundation: geometry, morphs and base maps. */
    FOUNDATION: 1,
    /** The skin colour maps, head and body. */
    SKIN: 2,
    /** Normal and specular contributions. */
    SURFACE: 4,
    /** The eye material. */
    EYES: 8,
    /** The composed head diffuse. */
    HEAD: 16,
    /** The composed body diffuse. */
    BODY: 32
});
