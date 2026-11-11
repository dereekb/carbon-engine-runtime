import { CjsStorage } from "../../resource/storage/CjsStorage.js";
import { TnyStore } from "./TnyStore.js";

/**
 * Our host-owned storage facade. Carbon's RemoteFileCache caches resource files;
 * db/StringStore interns database values. Neither owns these application stores.
 * CjsStorage supplies the existing injected backend and memory implementation.
 * @cjs
 */
export class TnyStorage
{

    /**
     * Owned shared storage backend facade.
     * @type {CjsStorage|null}
     * @cjs
     */
    _storage = null;

    /**
     * Stable collection handles created by this manager.
     * @type {Map<string, TnyStore>}
     * @cjs
     */
    _stores = new Map();

    /**
     * Whether new operations are rejected.
     * @type {boolean}
     * @cjs
     */
    _closed = false;

    /**
     * Shared shutdown promise, created by the first Close call.
     * @type {Promise<void>|null}
     * @cjs
     */
    _closing = null;

    /**
     * Construct the shared storage service with host namespace and backend
     * options.
     * @param {object} [options] Options for this operation.
     * @cjs
     */
    constructor(options = {})
    {
        this._storage = new CjsStorage({ namespace: "tny", ...options });
    }

    /**
     * Stable names survive sessions; obtaining a handle does not open a database.
     * @param {string} name Member or registration name.
     * @returns {TnyStore}
     * @cjs
     */
    CreateStore(name)
    {
        this._GetStorage();
        if (typeof name !== "string" || !name.trim() || name !== name.trim())
            throw new TypeError("Store name must be a nonempty, trimmed string");
        if (!this._stores.has(name)) this._stores.set(name, new TnyStore(this, name));
        return this._stores.get(name);
    }

    /**
     * Includes persisted stores that have not been requested in this session.
     * @returns {Promise<Array>}
     * @cjs
     */
    async List()
    {
        return this._GetStorage().List();
    }

    /**
     * Existing saved records are protected unless explicitly included.
     * @param {object} [options] Set includeSaved to remove saved records as well as cache records.
     * @returns {Promise<{deleted: number}>} Number of deleted identities.
     * @cjs
     */
    async Purge(options)
    {
        return this._GetStorage().Purge(options);
    }

    /**
     * Return the underlying storage service or reject use after closure.
     * @returns {CjsStorage}
     * @cjs
     */
    _GetStorage()
    {
        if (this._closed) throw new Error("Storage is closed");
        return this._storage;
    }

    /**
     * Invalidate store handles and return the shared backend shutdown promise.
     * @returns {Promise<void>} Completion of the operation.
     * @cjs
     */
    Close()
    {
        if (!this._closing)
        {
            this._closed = true;
            this._closing = this._storage.Close();
        }
        return this._closing;
    }

    /**
     * Stable identity for diagnostics and registration.
     * @type {string}
     * @cjs
     */
    static className = "TnyStorage";

}

