import { meta, type } from "#schema";
import { vec4 } from "#math/vec4";

// Discovery: src/character/discovery/color.yaml
// Resource pattern: res:/graphics/character/*

/**
 * A colour variation: three colours, three specular colours and an optional pattern. Each colour is its own
 * field, as Carbon exposes `EveSOFDataFactionColorSet` colour by colour; the file's `colors`, `specularColors` and
 * `patternColors` lists are translated by the reader (`CjsCharacterLibraryConfiguration.sourceLists`). The pattern
 * field names are the former catalog record's (CjsCharacterMaterialProfile: `patternTransform`, `patternRotation`).
 */
@meta.define("CjsCharacterColorVariation")
export class CjsCharacterColorVariation
{

    /** Colour area 1's RGBA colour (the file's `colors[0]`). */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.color
    color1 = vec4.create();

    /** Colour area 2's RGBA colour (the file's `colors[1]`). */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.color
    color2 = vec4.create();

    /** Colour area 3's RGBA colour (the file's `colors[2]`). */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.color
    color3 = vec4.create();

    /** Authored pattern name, retained as written. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.string
    pattern = "";

    /** The pattern colour the pattern texture's R channel selects (the file's `patternColors[0]`). */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.color
    patternColor1 = vec4.create();

    /** The pattern colour the pattern texture's G channel selects (`patternColors[1]`). */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.color
    patternColor2 = vec4.create();

    /** The pattern colour the pattern texture's B channel selects (`patternColors[2]`). */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.color
    patternColor3 = vec4.create();

    /** Colour area 2's colour under the pattern (`patternColors[3]`). */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.color
    patternAreaColor2 = vec4.create();

    /** Colour area 3's colour under the pattern (`patternColors[4]`). */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.color
    patternAreaColor3 = vec4.create();

    /** The pattern's placement: offset x, y, then repeat x, y (`patternColors[5]`). */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.vec4
    patternTransform = vec4.create();

    /** The pattern's rotation in degrees (`patternColors[6]`). */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.float64
    patternRotation = 0;

    /** Colour area 1's specular colour (the file's `specularColors[0]`); neutral grey when the file has none. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.color
    specularColor1 = vec4.fromValues(.5, .5, .5, 1);

    /** Colour area 2's specular colour (the file's `specularColors[1]`); neutral grey when the file has none. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.color
    specularColor2 = vec4.fromValues(.5, .5, .5, 1);

    /** Colour area 3's specular colour (the file's `specularColors[2]`); neutral grey when the file has none. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.color
    specularColor3 = vec4.fromValues(.5, .5, .5, 1);

    /**
     * The specular colour of a palette that tints nothing: mid grey, opaque. 229 of build 3662168's 2,555
     * palettes state no specular colours, and their records hold this (2026-11-01, colour reshape): before it, a
     * palette without them could not be read with its specular colours.
     */
    static neutralSpecular = [ .5, .5, .5, 1 ];

    /** The shipped pattern textures; a palette's `pattern` names one (`caldari_C` is `caldari_c_z.dds`). */
    static patternRoot = "res:/graphics/character/patterns/";

    /**
     * A patterned palette's pattern, as patternblit takes it: the three pattern colours (the pattern texture's R, G
     * and B select them), the colours of areas 2 and 3, the placement and the rotation; the palette's own `colors`
     * are what the item shows without its pattern. That reading is ours, from the data: the third colour is set
     * wherever the pattern uses its B channel (31 of 31 shipped palettes), and the area colours match the names
     * (`stealth` dark, `white` white, `blueorange` blue and orange) where `colors` do not (`stealth` area 2 is red).
     *
     * Ours (non-carbon-extensions.md § *The shared character library*): moved from Graphene's
     * `palettes.js` (`PatternOf`) with `CjsCharacterLibraryManager.FetchPalette`.
     *
     * @param {CjsCharacterColorVariation} value The palette.
     * @returns {{ map: string, colors: Float32Array[], areas: Float32Array[], transform: Float32Array, rotation: number }}
     *   The pattern texture, its three colours, the colours of areas 2 and 3, its placement (offset x, y;
     *   repeat x, y) and its rotation in degrees.
     */
    static patternOf(value)
    {
        return {
            map: CjsCharacterColorVariation.patternRoot + value.pattern.toLowerCase() + "_z.dds",
            colors: [ value.patternColor1, value.patternColor2, value.patternColor3 ].map(color => Float32Array.from(color)),
            areas: [ value.patternAreaColor2, value.patternAreaColor3 ].map(color => Float32Array.from(color)),
            transform: Float32Array.from(value.patternTransform),
            rotation: value.patternRotation
        };
    }

}
