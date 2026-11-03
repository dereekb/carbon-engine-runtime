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

    /**
     * Draws a backdrop behind the scene, or clears it.
     * @param {object} scene The `Tr2InteriorScene`.
     * @param {string} path A backdrop's resource path from `list`, or "" for none.
     * @param {object} [options] The placement.
     * @param {string} [options.fit="cover"] `cover`, `contain` or `stretch`.
     * @param {ArrayLike<number>} [options.color=[0, 0, 0, 1]] RGBA shown outside the image.
     * @returns {Tr2Effect|null} The scene's background effect.
     */
    static apply(scene, path, { fit = "cover", color = [ 0, 0, 0, 1 ] } = {})
    {
        if (!path)
        {
            scene.backgroundEffect = null;
            return null;
        }
        if (!Object.hasOwn(CjsCharacterBackdrops.fits, fit)) throw new TypeError(`Backdrop fit must be cover, contain or stretch, not ${fit}.`);
        const effect = new Tr2Effect();
        effect.SetEffectPathName(CjsCharacterBackdrops.effectPath);
        effect.SetParameter__Vector4("BackgroundPlacement", [ 0, 0, 1, 1 ]);
        effect.SetParameter__Vector4("BackgroundSettings", [ CjsCharacterBackdrops.fits[fit], 0, 0, 0 ]);
        effect.SetParameter__Vector4("BackgroundColor", color);
        effect.SetParameter__Vector4("BackgroundTint", [ 1, 1, 1, 1 ]);
        effect.SetResourceTexture2D("BackgroundMap", path);
        scene.backgroundEffect = effect;
        return effect;
    }

}
