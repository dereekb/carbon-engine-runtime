/**
 * Our collection-scoped handle. It cannot close or purge the shared backend.
 * @cjs
 */
export class TnyStore
{

    /**
     * Borrowed storage manager that owns this handle lifetime.
     * @type {TnyStorage|null}
     * @cjs
     */
    _owner = null;

    /**
     * Collection name used for every operation.
     * @type {string}
     * @cjs
     */
    _name = "";

    /**
     * Bind a named collection to its owning storage manager.
     * @param {TnyStorage} owner Borrowed owner of this facade.
     * @param {string} name Member or registration name.
     * @cjs
     */
    constructor(owner, name)
    {
        this._owner = owner;
        this._name = name;
    }

    /**
     * Return the stable collection name.
     * @returns {string}
     * @cjs
     */
    get name()
    {
        return this._name;
    }

    /**
     * Read one key from this collection using the owner storage queue.
     * @param {string|number} key Record identity within this collection.
     * @param {object} [options] Read version and expiry options accepted by CjsStorage.
     * @returns {Promise<import("../../resource/storage/CjsStorage.js").CjsStorageReadResult>} Value or cache-miss details.
     * @cjs
     */
    async Read(key, options)
    {
        return this._owner._GetStorage().Read(this._name, key, options);
    }

    /**
     * Write one value under a key in this collection.
     * @param {string|number} key Record identity within this collection.
     * @param {*} value Value to write.
     * @param {object} [options] Storage kind, version and expiry options.
     * @returns {Promise<import("../../resource/storage/CjsStorage.js").CjsStorageWriteResult>} Storage outcome.
     * @cjs
     */
    async Write(key, value, options)
    {
        return this._owner._GetStorage().Write(this._name, key, value, options);
    }

    /**
     * Write a batch of values scoped to this collection.
     * @param {object[]} entries Batch records forwarded to storage.
     * @returns {Promise<import("../../resource/storage/CjsStorage.js").CjsStorageWriteResult>} Storage outcome.
     * @cjs
     */
    async WriteBatch(entries)
    {
        return this._owner._GetStorage().WriteBatch(this._name, entries);
    }

    /**
     * Delete one key from this collection.
     * @param {string|number} key Record identity within this collection.
     * @returns {Promise<{deleted: boolean, error: object|null}>} Deletion outcome.
     * @cjs
     */
    async Delete(key)
    {
        return this._owner._GetStorage().Delete(this._name, key);
    }

    /**
     * List identities belonging to this collection.
     * @returns {Promise<object[]>} Record identities including namespace, collection, key and version.
     * @cjs
     */
    async List()
    {
        return this._owner._GetStorage().List(this._name);
    }

    /**
     * Stable identity for diagnostics and registration.
     * @type {string}
     * @cjs
     */
    static className = "TnyStore";

}

