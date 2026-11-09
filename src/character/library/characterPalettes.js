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
