import { TnyService } from "./TnyService.js";

// Source: our host data-provider orchestration, not a native Carbon cache.
/**
 * Shared query caching; only successful, build-verified provider results enter storage.
 * @cjs
 */
export class TnyServiceDatabase extends TnyService
{

    /**
     * Injected scoped store for reconstructible query results.
     * @type {TnyStore|null}
     * @cjs
     */
    _store = null;

    /**
     * Provider configuration identity included in cache keys.
     * @type {string}
     * @cjs
     */
    _scope = "";

    /**
     * In-flight source reads shared by equivalent cache keys.
     * @type {Map<string, Promise<*>>}
     * @cjs
     */
    _pending = new Map();

    /**
     * Whether new operations are rejected.
     * @type {boolean}
     * @cjs
     */
    _closed = false;

    /**
     * Bind query caching to an injected store and provider scope.
     * @param {TnyStore} store Injected scoped query cache.
     * @param {string} scope Provider configuration identity.
     * @cjs
     */
    constructor(store, scope)
    {
        super();
        this._store = store;
        this._scope = scope;
    }

    /**
     * Coalesce matching reads, use valid cached results and tolerate cache
     * failures.
     * @param {object} identity Explicit identity and provenance for the operation.
     * @param {string} operation Cache operation discriminator.
     * @param {*} args Serializable arguments included in the cache key.
     * @param {Function} read Asynchronous source read performed on a cache miss.
     * @returns {Promise<*>}
     * @cjs
     */
    async _Cached(identity, operation, args, read)
    {
        if (this._closed) throw new Error("Database provider is closed");
        const key = JSON.stringify([this._scope, identity, operation, args]);
        if (!this._pending.has(key))
        {
            const pending = (async () =>
            {
                // A corrupt or unavailable reconstructible cache is a miss, never a saved document.
                try
                {
                    const cached = await this._store.Read(key, { version: identity.revision });
                    if (cached.found) return cached.value;
                }
                catch
                {
                    /* Reacquire derived data. */
                }
                const value = await read();
                if (value === undefined) throw new TypeError("Database provider returned undefined");
                try
                {
                    await this._store.Write(key, value, { kind: "cache", version: identity.revision });
                }
                catch
                {
                    /* Successful source reads remain usable without persistence. */
                }
                return value;
            })();
            this._pending.set(key, pending);
            pending.finally(() => this._pending.delete(key)).catch(() =>
            {

            });
        }
        return structuredClone(await this._pending.get(key));
    }

    /**
     * Reject new queries and wait for outstanding source reads to settle.
     * @returns {Promise<void>} Completion of the operation.
     * @cjs
     */
    async Close()
    {
        this._closed = true;
        await Promise.allSettled([...this._pending.values()]);
    }

    /**
     * Stable identity for diagnostics and registration.
     * @type {string}
     * @cjs
     */
    static className = "TnyServiceDatabase";

    /**
     * Null opts out of storage; an empty policy requests a scoped store.
     * @type {object|null}
     * @cjs
     */
    static storagePolicy = {};

}

