import { CjsSchema } from "#schema";
import { CjsLibrary } from "../../core/CjsLibrary.js";
import { EveShip2 } from "../../trinity/eve/spaceObject/EveShip2.js";

/** Application convenience for a live ship acquired through an explicit library. */
export class TnyShip
{
    static className = "TnyShip";

    /** Borrowed library; the wrapper never starts or shuts it down. */
    library = null;

    /** Existing ship graph; wrapping neither copies nor initializes it. */
    wrapped = null;

    /** Borrows a library and a compatible live ship without changing either. */
    constructor(library, wrapped)
    {
        if (!CjsSchema.cast(library, CjsLibrary)) throw new TypeError("TnyShip requires a CjsLibrary.");
        if (!CjsSchema.cast(wrapped, EveShip2)) throw new TypeError("TnyShip requires a live EveShip2.");
        this.library = library;
        this.wrapped = wrapped;
    }

    /**
     * Acquires a fresh ship through the library and starts its existing controllers.
     * The library owns DNA hydration; this does not initialize the graph again or
     * wait for all of its rendering resources. Fetch and controller failures reject.
     *
     * @param {CjsLibrary} library Initialized library, pumped by its host.
     * @param {string} source DNA or object resource path.
     * @param {object} [options={}] Passed unchanged to the library.
     * @returns {Promise<TnyShip>} Wrapper borrowing the acquired ship.
     */
    static async fetch(library, source, options = {})
    {
        if (!CjsSchema.cast(library, CjsLibrary)) throw new TypeError("TnyShip requires a CjsLibrary.");
        if (typeof source !== "string" || !source) throw new TypeError("TnyShip requires DNA or an object path.");

        const ship = new TnyShip(library, await library.Fetch(source, options));
        ship.wrapped.StartControllers();
        return ship;
    }
}
