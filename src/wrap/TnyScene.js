import { CjsSchema } from "#schema";
import { CjsLibrary } from "../core/CjsLibrary.js";
import { EveSpaceScene } from "../trinity/eve/scene/EveSpaceScene.js";
import { TnySpaceObject } from "./objects/TnySpaceObject.js";
import { TnyMobile } from "./objects/TnyMobile.js";
import { TnyShip } from "./objects/TnyShip.js";
import { TnyStationary } from "./objects/TnyStationary.js";
import { Tr2PostProcess2 } from "../trinity/postProcess/Tr2PostProcess2.js";

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
     * The wrapper classes `Fetch` chooses from, most specific first: the first
     * whose native class the object is wins (ccpwgl's TnyScene.EVE_CLASS).
     */
    static WRAPPERS = [ TnyShip, TnyMobile, TnyStationary, TnySpaceObject ];

    /**
     * Acquires a space object, wraps it in the most specific wrapper, starts
     * its controllers and adds it to this scene.
     *
     * @param {object} options `TnySpaceObject.fetch` options: `dna` or `resPath`, `awaitResources`, `name`.
     * @returns {Promise<TnySpaceObject>} The wrapper, now in this scene.
     * @throws {TypeError} When the object is no space object.
     */
    async Fetch(options = {})
    {
        const object = await TnySpaceObject.acquire(options);
        const Wrapper = TnyScene.WRAPPERS.find(Candidate => CjsSchema.cast(object, Candidate.wrappedClass));
        if (!Wrapper) throw new TypeError("TnyScene.Fetch requires a live EveSpaceObject2.");
        const wrapper = Wrapper.fromWrapped(object, options);
        this.AddObject(wrapper);
        return wrapper;
    }

    /**
     * Adds a space object through the native scene list, once. The scene owns registration.
     * @param {TnySpaceObject} object Object to add.
     * @returns {boolean} True when newly added; false when already present.
     */
    AddObject(object)
    {
        this._ValidateObject(object);
        const objects = this.wrapped.objects;
        if (objects.indexOf(object.wrapped) !== -1) return false;
        if (!objects.Append(object.wrapped)) throw new TypeError("The scene rejected the object.");
        this._objects.push(object);
        return true;
    }

    /**
     * Removes membership without destroying the object or its resources.
     * @param {TnySpaceObject} object Object to remove.
     * @returns {boolean} Whether the ship was present and removed.
     */
    RemoveObject(object)
    {
        this._ValidateObject(object);
        const objects = this.wrapped.objects;
        const index = objects.indexOf(object.wrapped);
        // BlueList.Remove(-1) clears the list, so absence must never reach it.
        if (index === -1 || !objects.Remove(index)) return false;
        this._objects.splice(this._objects.indexOf(object), 1);
        return true;
    }

    /**
     * The scene's default post process (Carbon's m_sceneDefaultPostProcess)
     * from a shipped environment template, replacing the authored one; null
     * restores the authored one. The scene merges it with any post-process
     * volumes itself.
     *
     * @param {string|null} source A template name under
     *   `res:/dx9/postprocess/environmenttemplate/`, a resource path, or null.
     * @returns {Promise<string|null>} The path now in use, or null for the authored one.
     */
    async SetPostProcess(source)
    {
        if (this._authoredPostProcess === undefined) this._authoredPostProcess = this.wrapped.postprocess;
        if (source === null)
        {
            this.wrapped.postprocess = this._authoredPostProcess;
            this.postProcessPath = null;
            return null;
        }
        if (typeof source !== "string" || !source) throw new TypeError("TnyScene.SetPostProcess requires a template name, a path or null.");

        const library = CjsLibrary.instance;
        if (!library) throw new Error("TnyScene requires an initialized CjsLibrary.");
        const path = source.includes("/") ? source : `${TnyScene.POST_PROCESS_TEMPLATES}${source}.black`;
        const postProcess = await library.Fetch(path);
        if (!CjsSchema.cast(postProcess, Tr2PostProcess2)) throw new TypeError(`${path} is not a Tr2PostProcess2.`);
        this.wrapped.postprocess = postProcess;
        this.postProcessPath = path;
        return path;
    }

    /** @returns {TnySpaceObject[]} The wrappers this scene added, in order. */
    GetObjects()
    {
        return this._objects.slice();
    }

    /** The wrappers added through AddObject. */
    _objects = [];

    /** Where shipped environment post-process templates live. */
    static POST_PROCESS_TEMPLATES = "res:/dx9/postprocess/environmenttemplate/";

    /** The template SetPostProcess loaded, or null while the authored one is in use. */
    postProcessPath = null;

    /** The post process the scene was authored with; undefined until SetPostProcess first runs. */
    _authoredPostProcess = undefined;

    /** Rejects incompatible wrappers before mutating the native list. */
    _ValidateObject(object)
    {
        if (!CjsSchema.cast(object, TnySpaceObject))
            throw new TypeError("TnyScene requires a TnySpaceObject.");
    }
}
