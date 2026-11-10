import { CjsSchema } from "#schema";
import { CjsLibrary } from "../../core/CjsLibrary.js";
import { EveSpaceObject2 } from "../../trinity/eve/spaceObject/EveSpaceObject2.js";

/**
 * Application convenience for a live space object acquired through the shared
 * library. Ours: ccpwgl's TnySpaceObject (our own code there) is the shape.
 * Subclasses narrow the native class they borrow; `fetch` on a subclass
 * requires that class.
 */
export class TnySpaceObject
{
    static className = "TnySpaceObject";

    /** The native class this wrapper borrows. */
    static wrappedClass = EveSpaceObject2;

    /** Its registered name, for errors. */
    static wrappedName = "EveSpaceObject2";

    /** Existing object graph; wrapping neither copies nor initializes it. */
    wrapped = null;

    /** Borrows a compatible live object without initializing or copying it. */
    constructor(wrapped)
    {
        const { wrappedClass, wrappedName, className } = this.constructor;
        if (!CjsSchema.cast(wrapped, wrappedClass)) throw new TypeError(`${className} requires a live ${wrappedName}.`);
        this.wrapped = wrapped;
    }

    /**
     * Acquires a fresh object through the library and starts its existing
     * controllers. The library owns DNA hydration and the resource wait; this
     * does not initialize the graph again. Fetch and controller failures reject.
     *
     * @param {object} options What to fetch.
     * @param {string} [options.dna] DNA; give this or `resPath`.
     * @param {string} [options.resPath] Object resource path; give this or `dna`.
     * @param {boolean} [options.awaitResources=false] Resolve once the object's resources have loaded.
     * @param {string} [options.name] Sets the object's `name`.
     * @returns {Promise<TnySpaceObject>} An instance of the class it was called on.
     */
    static async fetch(options = {})
    {
        return this.fromWrapped(await TnySpaceObject.acquire(options), options);
    }

    /**
     * Wraps an acquired object in this class, sets its name and starts its controllers.
     *
     * @param {object} object The live object.
     * @param {{name?: string|null}} [options] Fetch options.
     * @returns {TnySpaceObject} The wrapper.
     */
    static fromWrapped(object, { name = null } = {})
    {
        const wrapper = new this(object);
        if (name !== null) wrapper.wrapped.name = name;
        wrapper.wrapped.StartControllers();
        return wrapper;
    }

    /**
     * Validates fetch options and acquires the object through the library.
     *
     * @param {object} options See `fetch`.
     * @returns {Promise<object|null>} The live object.
     */
    static async acquire({ dna = null, resPath = null, awaitResources = false, name = null, ...unknown } = {})
    {
        const library = CjsLibrary.instance;
        if (!library) throw new Error(`${this.className} requires an initialized CjsLibrary.`);
        const extra = Object.keys(unknown);
        if (extra.length) throw new TypeError(`${this.className}.fetch does not take ${extra.join(", ")}.`);
        const source = dna ?? resPath;
        if (typeof source !== "string" || !source || (dna !== null && resPath !== null))
            throw new TypeError(`${this.className} requires DNA or an object path.`);
        if (name !== null && typeof name !== "string") throw new TypeError(`${this.className} name must be a string.`);
        return library.Fetch(source, { awaitResources });
    }
}
