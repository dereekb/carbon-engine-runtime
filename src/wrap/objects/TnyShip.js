import { CjsSchema } from "#schema";
import { CjsLibrary } from "../../core/CjsLibrary.js";
import { EveShip2 } from "../../trinity/eve/spaceObject/EveShip2.js";

/** Application convenience for a live ship acquired through the shared library. */
export class TnyShip
{
    static className = "TnyShip";

    /** Existing ship graph; wrapping neither copies nor initializes it. */
    wrapped = null;

    /** Borrows a compatible live ship without initializing or copying it. */
    constructor(wrapped)
    {
        if (!CjsSchema.cast(wrapped, EveShip2)) throw new TypeError("TnyShip requires a live EveShip2.");
        this.wrapped = wrapped;
    }

    /**
     * Acquires a fresh ship through the library and starts its existing controllers.
     * The library owns DNA hydration and the resource wait; this does not
     * initialize the graph again. Fetch and controller failures reject.
     * ccpwgl's `TnySpaceObject.fetch(options)` shape (our own code there).
     *
     * @param {object} options What to fetch.
     * @param {string} [options.dna] Ship DNA; give this or `resPath`.
     * @param {string} [options.resPath] Object resource path; give this or `dna`.
     * @param {boolean} [options.awaitResources=false] Resolve once the ship's resources have loaded.
     * @param {string} [options.name] Sets the ship's `name`.
     * @returns {Promise<TnyShip>} Wrapper borrowing the acquired ship.
     */
    static async fetch({ dna = null, resPath = null, awaitResources = false, name = null, ...unknown } = {})
    {
        const library = CjsLibrary.instance;
        if (!library) throw new Error("TnyShip requires an initialized CjsLibrary.");
        const extra = Object.keys(unknown);
        if (extra.length) throw new TypeError(`TnyShip.fetch does not take ${extra.join(", ")}.`);
        const source = dna ?? resPath;
        if (typeof source !== "string" || !source || (dna !== null && resPath !== null))
            throw new TypeError("TnyShip requires DNA or an object path.");

        const ship = new TnyShip(await library.Fetch(source, { awaitResources }));
        if (name !== null) ship.wrapped.name = name;
        ship.wrapped.StartControllers();
        return ship;
    }
}
