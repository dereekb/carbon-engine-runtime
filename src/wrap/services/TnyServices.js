
/**
 * Our host service registry. It constructs lazily and injects scoped storage;
 * it does not register Blue classes or infer data-provider routing.
 * @cjs
 */
export class TnyServices
{

    /**
     * Owned application storage manager.
     * @type {TnyStorage|null}
     * @cjs
     */
    _storage = null;

    /**
     * Registered constructors, options and lazily constructed instances.
     * @type {Map<string, object>}
     * @cjs
     */
    _services = new Map();

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
     * Retain the storage manager used for service store injection.
     * @param {TnyStorage} storage Storage manager borrowed by this registry.
     * @cjs
     */
    constructor(storage)
    {
        this._storage = storage;
    }

    /**
     * Validate and retain a named service constructor without instantiating it.
     * @param {string} name Member or registration name.
     * @param {Function} Constructor Service constructor; receives its scoped store and options.
     * @param {object} [options] Options for this operation.
     * @returns {TnyServices}
     * @cjs
     */
    Register(name, Constructor, options = {})
    {
        this._AssertOpen();
        if (typeof name !== "string" || !name.trim() || name !== name.trim())
            throw new TypeError("Service name must be a nonempty, trimmed string");
        if (this._services.has(name)) throw new Error("Service " + name + " is already registered");
        if (typeof Constructor !== "function") throw new TypeError("Service " + name + " requires a constructor");
        ValidateStoragePolicy(Constructor.storagePolicy, name);
        this._services.set(name, { Constructor, options, usesStorage: Constructor.storagePolicy !== null,
            instance: null, constructing: false });
        return this;
    }

    /**
     * Return one instance per registration, or null when no service has that name.
     * @param {string} name Member or registration name.
     * @returns {object|null}
     * @cjs
     */
    Get(name)
    {
        this._AssertOpen();
        const entry = this._services.get(name);
        if (!entry) return null;
        if (entry.instance) return entry.instance;
        if (entry.constructing) throw new Error("Circular service construction: " + name);
        entry.constructing = true;
        try
        {
            const store = entry.usesStorage ? this._storage.CreateStore(name) : null;
            const instance = new entry.Constructor(store, entry.options);
            entry.instance = instance;
            return instance;
        }
        finally
        {
            entry.constructing = false;
        }
    }

    /**
     * Return registered service names in registration order.
     * @returns {string[]}
     * @cjs
     */
    List()
    {
        return Array.from(this._services.keys());
    }

    /**
     * Reject acquisition or registration after shutdown begins.
     * @cjs
     */
    _AssertOpen()
    {
        if (this._closed) throw new Error("Services are closed");
    }

    /**
     * Prevent new acquisitions and return the shared shutdown promise.
     * @returns {Promise<void>} Completion of the operation.
     * @cjs
     */
    Close()
    {
        if (!this._closing)
        {
            this._closed = true;
            this._closing = this._CloseServices();
        }
        return this._closing;
    }

    /**
     * Close instantiated services in reverse registration order and collect
     * failures.
     * @returns {Promise<void>} Completion of the operation.
     * @cjs
     */
    async _CloseServices()
    {
        const errors = [];
        for (const { instance } of Array.from(this._services.values()).reverse())
        {
            if (!instance) continue;
            try
            {
                await instance.Close();
            }
            catch (error)
            {
                errors.push(error);
            }
        }
        if (errors.length) throw new AggregateError(errors, "Service shutdown failed");
    }

    /**
     * Stable identity for diagnostics and registration.
     * @type {string}
     * @cjs
     */
    static className = "TnyServices";

}


/**
 * Our storage opt-in declaration. Options are added only for a concrete consumer.
 * @param {object|null} policy Null opts out; an empty object requests storage.
 * @param {string} name Service name included in validation errors.
 * @cjs
 */
function ValidateStoragePolicy(policy, name)
{
    if (policy === null) return;
    if (!policy || Object.getPrototypeOf(policy) !== Object.prototype)
        throw new TypeError("Service " + name + ": storagePolicy must be null or a plain object");
    const keys = Reflect.ownKeys(policy);
    if (keys.length) throw new TypeError("Service " + name + ": unsupported storagePolicy field " + String(keys[0]));
}
