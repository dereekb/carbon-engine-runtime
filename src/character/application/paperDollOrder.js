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
    EYELINER: 100,
    LIPSTICK: 110,
    /** Over the lipstick and before every garment. */
    AUGMENTATIONS: 112,
    /** The hair painted on the scalp, over the face augmentations. */
    HAIR: 113,
    /** Body augmentations: with the face ones, before every garment. */
    BODYAUGMENTATION: 114,
    /** Facial hair, the last face covering: over the scalp hair. To confirm in the browser. */
    BEARD: 115,
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
 * The doll's bake targets, as bits: the maps a part's settings are baked into. A part class declares its targets
 * as `static targets`; each target has its own binding. The foundation (geometry, morphs and base maps) is an input
 * the archetype resolves, not a target.
 *
 * @readonly
 * @enum {number}
 */
export const PaperDollTarget = Object.freeze({
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

/**
 * How a part's look is composed: the compositing source its class draws through. Each part class declares one as
 * `static blend`; the paper doll picks a part's source by it.
 *
 * @readonly
 * @enum {number}
 */
export const PaperDollBlend = Object.freeze({
    /** Composed maps drawn as they are (`comp_<region>_<suffix>`): aging, freckles, scarring, scars, augmentations. */
    DECAL: 1,
    /**
     * A colourised detail and zone map with a palette: skin, eyebrows, blush, eye shadow, eyeliner, lipstick; and the
     * eyes, whose option is a colourised detail or a diffuse drawn as it is.
     */
    COLORIZE: 2,
    /** A worn item's material: its colourised detail, zone, normal and specular through its coverage. */
    MATERIAL: 3,
    /** Projected onto the head mesh and baked: tattoos. */
    PROJECTION: 4,
    /** A mesh with its own maps; nothing composed: accessories. */
    MESH: 5
});

/**
 * Where a colourised part's palette files live: each option's own folder, or the category's catalog (the options'
 * folders and the category's `colors/`). Each part class declares one as `static palettes`; which palettes a menu
 * shows, and how it labels them, is the UI's.
 *
 * @readonly
 * @enum {number}
 */
export const PaperDollPalettes = Object.freeze({
    /** Each option's own `.color` files (eye shadow, eyeliner). */
    OWN: 1,
    /** The category's catalog: every option's `.color` files and the category's `colors/` (blush, eyebrows; tattoos, whose options have none). */
    CATALOG: 2
});

/**
 * Which colour areas a palette file sets. Derived (as in the game's creator, not a source): `<name>_a.color` sets
 * area 1, `<name>_bc.color` areas 2 and 3; any other palette all three.
 *
 * @readonly
 * @enum {number}
 */
export const PaperDollPaletteKind = Object.freeze({
    /** Areas 1 to 3. */
    WHOLE: 1,
    /** Area 1 (`_a`). */
    AREA_1: 2,
    /** Areas 2 and 3 (`_bc`). */
    AREAS_2_3: 3
});
