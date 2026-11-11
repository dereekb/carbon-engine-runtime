/**
 * Our host service base, not a Blue object or native service port.
 * The manager injects a scoped store only when storagePolicy requests one.
 * @cjs
 */
export class TnyService
{

    /**
     * Release service-owned work; the storage manager owns the store lifetime.
     * @returns {Promise<void>} Completion of the operation.
     * @cjs
     */
    async Close()
    {

    }

    /**
     * Stable identity for diagnostics and registration.
     * @type {string}
     * @cjs
     */
    static className = "TnyService";

    /**
     * Null opts out of storage; an empty policy requests a scoped store.
     * @type {object|null}
     * @cjs
     */
    static storagePolicy = null;

}

