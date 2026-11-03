import { blue } from "#blue";
import { Tr2Effect } from "../../trinity/shader/Tr2Effect.js";

/**
 * EVE's character creator backgrounds, drawn behind an interior scene's characters.
 *
 * Not Carbon: the backdrops are UI textures, and no shipped interior scene authors a background effect. Each is drawn
 * through Carbon's own hook, `Tr2InteriorScene.backgroundEffect`, which the scene draws as a camera-space screen quad
 * before its geometry (Tr2InteriorScene.cpp:648-651), with the 2D background-image effect registered in the
 * non-Carbon extensions register (its interior entry, `backgroundimageinterior.fx`). The editor's "None" clears the
 * effect, so the scene shows its clear colour.
 */
export class CjsCharacterBackdrops
{

    static className = "CjsCharacterBackdrops";

    /** The folder the creator's backdrops are listed from. */
    static directory = "res:/ui/texture/charactercreation/backdrops/";

    /** The 2D background-image effect, over the interior scene's per-frame buffers. */
    static effectPath = "res:/graphics/effect/cjs/specialfx/backgroundimageinterior.fx";

    /** The fit modes, as the effect's `BackgroundSettings.x`. */
    static fits = { stretch: 0, cover: 1, contain: 2 };

    /** The wrap modes outside the image, as the effect's `BackgroundSettings.y`. */
    static wraps = { border: 0, clamp: 1, repeat: 2, mirror: 3 };

    /**
     * The backdrops: every `background_<name>.dds` in the folder except the `_thumb` copies, numbered ones first in
     * number order, then the named ones by name.
     * @returns {{name: string, path: string, thumbnail: string|null}[]} The backdrops.
     */
    static list()
    {
        const files = new Set(blue.paths.GetDirectoryContents(CjsCharacterBackdrops.directory));
        const list = [];
        for (const file of files)
        {
            const match = /^background_(.+)\.dds$/iu.exec(file);
            if (!match || /_thumb$/iu.test(match[1])) continue;
            const thumbnail = `background_${match[1]}_thumb.dds`;
            list.push({
                name: match[1],
                path: CjsCharacterBackdrops.directory + file,
                thumbnail: files.has(thumbnail) ? CjsCharacterBackdrops.directory + thumbnail : null
            });
        }
        const number = name => /^\d+$/u.test(name) ? Number(name) : Infinity;
        return list.sort((a, b) => number(a.name) - number(b.name) || a.name.localeCompare(b.name));
    }

    /** The effect `apply` last set on each scene, which it destructs when it replaces or clears it. */
    static _applied = new WeakMap();

    /**
     * Draws a backdrop behind the scene, or clears it. The backdrop effect this set before is destructed; a
     * background effect the scene had from elsewhere is replaced but left alone.
     * @param {object} scene The `Tr2InteriorScene`.
     * @param {string} path A backdrop's resource path from `list` (or any 2D image), or "" for none.
     * @param {object} [placement] The placement; see `SetPlacement`.
     * @returns {Tr2Effect|null} The scene's background effect.
     */
    static apply(scene, path, placement = {})
    {
        const previous = CjsCharacterBackdrops._applied.get(scene);
        if (path) CjsCharacterBackdrops._check(placement);
        if (previous)
        {
            CjsCharacterBackdrops._applied.delete(scene);
            if (scene.backgroundEffect === previous) scene.backgroundEffect = null;
            previous.Destruct();
        }
        if (!path)
        {
            scene.backgroundEffect = null;
            return null;
        }
        const effect = new Tr2Effect();
        effect.SetEffectPathName(CjsCharacterBackdrops.effectPath);
        effect.SetParameter__Vector4("BackgroundTint", [ 1, 1, 1, 1 ]);
        effect.SetResourceTexture2D("BackgroundMap", path);
        scene.backgroundEffect = effect;
        CjsCharacterBackdrops._applied.set(scene, effect);
        CjsCharacterBackdrops.SetPlacement(scene, placement);
        return effect;
    }

    /**
     * Places the backdrop `apply` set on the scene; does nothing when it has none. Omitted values take their
     * defaults, so each call describes the whole placement.
     * @param {object} scene The `Tr2InteriorScene`.
     * @param {object} [placement] The placement.
     * @param {string} [placement.fit="cover"] `cover`, `contain` or `stretch`.
     * @param {string} [placement.wrap="border"] `border` (the colour outside), `clamp`, `repeat` or `mirror`.
     * @param {ArrayLike<number>} [placement.offset=[0, 0]] The image centre's offset, in screen widths and heights.
     * @param {ArrayLike<number>} [placement.scale=[1, 1]] The image's scale after fitting.
     * @param {ArrayLike<number>} [placement.color=[0, 0, 0, 1]] RGBA shown outside the image in border mode.
     * @returns {Tr2Effect|null} The backdrop effect, or null.
     */
    static SetPlacement(scene, placement = {})
    {
        const { fit, wrap, offset, scale, color } = CjsCharacterBackdrops._check(placement);
        const effect = CjsCharacterBackdrops._applied.get(scene) ?? null;
        if (!effect) return null;
        effect.SetParameter__Vector4("BackgroundPlacement", [ offset[0], offset[1], scale[0], scale[1] ]);
        effect.SetParameter__Vector4("BackgroundSettings", [ CjsCharacterBackdrops.fits[fit], CjsCharacterBackdrops.wraps[wrap], 0, 0 ]);
        effect.SetParameter__Vector4("BackgroundColor", color);
        return effect;
    }

    /**
     * Fills a placement's defaults and checks its modes.
     * @param {object} placement The placement.
     * @returns {{fit: string, wrap: string, offset: ArrayLike<number>, scale: ArrayLike<number>, color: ArrayLike<number>}} The full placement.
     */
    static _check({ fit = "cover", wrap = "border", offset = [ 0, 0 ], scale = [ 1, 1 ], color = [ 0, 0, 0, 1 ] } = {})
    {
        if (!Object.hasOwn(CjsCharacterBackdrops.fits, fit)) throw new TypeError(`Backdrop fit must be cover, contain or stretch, not ${fit}.`);
        if (!Object.hasOwn(CjsCharacterBackdrops.wraps, wrap)) throw new TypeError(`Backdrop wrap must be border, clamp, repeat or mirror, not ${wrap}.`);
        return { fit, wrap, offset, scale, color };
    }

}
