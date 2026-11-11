import { CjsSchema } from "#schema";
import { Copier } from "../../blue/exposure/Copier.js";
import { CjsLibrary } from "../../core/CjsLibrary.js";
import { EveMeshOverlayEffect } from "../../trinity/eve/overlays/EveMeshOverlayEffect.js";

/** The prefix of an overlay's bindings that the host points at the object it overlays. */
const SELF = "self_";

/**
 * A space object's mesh overlays (EveSpaceObject2.overlayEffects) beyond its
 * core damage overlays: what it has, and adding or removing shipped ones such
 * as `res:/fisfx/cloaking/*.black`. Ours. Adding does the client's part, as
 * Graphene's demo does: each object gets its own copy, the copy's `self_`
 * bindings are pointed at the object, and its curve set plays.
 * @cjs
 */
export class TnyOverlays
{

    /**
     * The TnySpaceObject whose overlays these are.
     * @type {object|null}
     * @cjs
     */
    owner = null;

    /**
     * For each overlay added here: its path and the object members its bindings drove, before.
     * @type {Map}
     * @cjs
     */
    _added = new Map();

    /**
     * @param {import("./TnySpaceObject.js").TnySpaceObject} owner The wrapper.
     * @cjs
     */
    constructor(owner)
    {
        this.owner = owner;
    }

    /**
     * The object's overlays.
     *
     * @returns {{name: string, path: string|null, curveSet: string|null}[]} One per overlay; path is null for authored ones.
     * @cjs
     */
    GetOverlays()
    {
        return this.owner.wrapped.overlayEffects.map(overlay => ({
            name: overlay.name,
            path: this._added.get(overlay)?.path ?? null,
            curveSet: overlay.curveSet?.name ?? null
        }));
    }

    /**
     * Loads a shipped overlay, gives this object its own copy, binds it and plays it.
     *
     * @param {string} path An EveMeshOverlayEffect resource path.
     * @returns {Promise<string>} The added overlay's name.
     * @cjs
     */
    async Add(path)
    {
        const library = CjsLibrary.instance;
        if (!library) throw new Error("TnyOverlays requires an initialized CjsLibrary.");
        const loaded = CjsSchema.cast(await library.Fetch(path), EveMeshOverlayEffect);
        if (!loaded) throw new TypeError(`${path} is not an EveMeshOverlayEffect.`);

        // The library's object is shared through resMan's cache; bindings are per object.
        const overlay = new Copier().CloneTo(loaded);
        const object = this.owner.wrapped;
        const before = new Map();
        for (const binding of overlay.curveSet?.bindings ?? [])
        {
            if (!binding.name.startsWith(SELF)) continue;
            before.set(binding.destinationAttribute, object[binding.destinationAttribute]);
            binding.SetDestinationObject(object);
            binding.Initialize();
        }
        this._added.set(overlay, { path, before });
        object.overlayEffects.Append(overlay);
        if (overlay.curveSet) overlay.PlayCurveSet(overlay.curveSet.name);
        return overlay.name;
    }

    /**
     * Removes overlays added from a path, restoring the members their
     * bindings drove (Graphene's demo restores clipSphereFactor and
     * activationStrength after a cloak).
     *
     * @param {string} path The path given to Add.
     * @returns {boolean} Whether any was removed.
     * @cjs
     */
    Remove(path)
    {
        const object = this.owner.wrapped;
        let removed = false;
        for (const [ overlay, record ] of [ ...this._added ])
        {
            if (record.path !== path) continue;
            const index = object.overlayEffects.indexOf(overlay);
            if (index !== -1) object.overlayEffects.Remove(index);
            for (const [ attribute, value ] of record.before) this.owner._Bind(object, attribute).SetValue(value);
            this._added.delete(overlay);
            removed = true;
        }
        return removed;
    }

    /**
     * @returns {boolean} Whether an overlay from this path is on the object.
     * @param {string} path Resource or collection path.
     * @cjs
     */
    Has(path)
    {
        return [ ...this._added.values() ].some(record => record.path === path);
    }

    /**
     * Stable identity for diagnostics and registration.
     * @type {string}
     * @cjs
     */
    static className = "TnyOverlays";

}
