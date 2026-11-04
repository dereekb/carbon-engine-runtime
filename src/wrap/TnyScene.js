import { CjsSchema } from "#schema";
import { CjsLibrary } from "../core/CjsLibrary.js";
import { EveSpaceScene } from "../trinity/eve/scene/EveSpaceScene.js";
import { TnyShip } from "./objects/TnyShip.js";

/** Application membership wrapper over an existing space scene. */
export class TnyScene
{
    static className = "TnyScene";

    /** Existing scene graph; native lists retain their own admission and notifications. */
    wrapped = null;

    /** Borrows a space scene without initializing, rendering or copying it. */
    constructor(wrapped)
    {
        if (!CjsSchema.cast(wrapped, EveSpaceScene)) throw new TypeError("TnyScene requires a live EveSpaceScene.");
        this.wrapped = wrapped;
    }

    /**
     * Acquires an authored space scene, preserving acquisition and type failures.
     * @param {string} path Scene resource path.
     * @param {object} [options={}] Passed unchanged to the library.
     * @returns {Promise<TnyScene>} Wrapper over the acquired scene.
     */
    static async fetch(path, options = {})
    {
        const library = CjsLibrary.instance;
        if (!library) throw new Error("TnyScene requires an initialized CjsLibrary.");
        if (typeof path !== "string" || !path) throw new TypeError("TnyScene requires a scene resource path.");
        return TnyScene.fromWrapped(await library.Fetch(path, options));
    }

    /** Adapts an existing space scene without acquiring or initializing it again. */
    static fromWrapped(scene)
    {
        return new TnyScene(scene);
    }

    /**
     * Adds a ship through the native scene list, once. The scene owns registration.
     * @param {TnyShip} object Ship to add.
     * @returns {boolean} True when newly added; false when already present.
     */
    AddObject(object)
    {
        this._ValidateObject(object);
        const objects = this.wrapped.objects;
        if (objects.indexOf(object.wrapped) !== -1) return false;
        if (!objects.Append(object.wrapped)) throw new TypeError("The scene rejected the ship.");
        return true;
    }

    /**
     * Removes membership without destroying the ship or its resources.
     * @param {TnyShip} object Ship to remove.
     * @returns {boolean} Whether the ship was present and removed.
     */
    RemoveObject(object)
    {
        this._ValidateObject(object);
        const objects = this.wrapped.objects;
        const index = objects.indexOf(object.wrapped);
        // BlueList.Remove(-1) clears the list, so absence must never reach it.
        return index !== -1 && objects.Remove(index);
    }

    /** Rejects incompatible wrappers before mutating the native list. */
    _ValidateObject(object)
    {
        if (!CjsSchema.cast(object, TnyShip))
            throw new TypeError("TnyScene requires a TnyShip.");
    }
}
