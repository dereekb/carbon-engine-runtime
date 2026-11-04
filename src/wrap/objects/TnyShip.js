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
     * The library owns DNA hydration; this does not initialize the graph again or
     * wait for all of its rendering resources. Fetch and controller failures reject.
     *
     * @param {string} source DNA or object resource path.
     * @param {object} [options={}] Passed unchanged to the library.
     * @returns {Promise<TnyShip>} Wrapper borrowing the acquired ship.
     */
    static async fetch(source, options = {})
    {
        const library = CjsLibrary.instance;
        if (!library) throw new Error("TnyShip requires an initialized CjsLibrary.");
        if (typeof source !== "string" || !source) throw new TypeError("TnyShip requires DNA or an object path.");

        const ship = new TnyShip(await library.Fetch(source, options));
        ship.wrapped.StartControllers();
        return ship;
    }
}
