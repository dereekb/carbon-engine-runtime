import { CjsTableData } from "../../resource/format/CjsTableData.js";

// Source: our Tny orchestration extension; see services/README.md.
// Carbon's db/StringStore and Blue resource caches do not route host data providers.

/**
 * Host-owned table registry. Providers own acquisition; callers use one query surface.
 * @cjs
 */
export class TnyDatabase
{

    /**
     * Service registry used by this owner.
     * @type {TnyServices|null}
     * @cjs
     */
    _services = null;

    /**
     * Registered table schemas, provider names and provenance.
     * @type {Map<string, object>}
     * @cjs
     */
    _tables = new Map();

    /**
     * Whether new operations are rejected.
     * @type {boolean}
     * @cjs
     */
    _closed = false;

    /**
     * Bind table routing to the supplied service registry.
     * @param {TnyServices} services Service registry providing table data.
     * @cjs
     */
    constructor(services)
    {
        this._services = services;
    }

    /**
     * Register a description without constructing the provider or reading records.
     * @param {object} definition Table name and column definitions.
     * @param {object} options Options for this operation.
     * @param {string} options.service Registered provider service name.
     * @param {string} options.source Data source identity.
     * @param {string|number} options.build Positive build number, stored as a string.
     * @param {number} [options.revision=1] Cache representation revision.
     * @returns {TnyDatabase}
     * @cjs
     */
    Register(definition, { service, source, build, revision = 1 })
    {
        this._AssertOpen();
        const schema = CjsTableData.defineTable(definition);
        if (this._tables.has(schema.name)) throw new Error(`Table ${schema.name} is already registered`);
        if (!this._services.List().includes(service)) throw new Error(`Unknown provider service ${service}`);
        if (typeof source !== "string" || !source || !/^[1-9][0-9]*$/.test(String(build)))
            throw new TypeError("Table source and an explicit positive build number are required");
        if (!Number.isSafeInteger(revision) || revision < 1) throw new TypeError("Invalid table representation revision");
        const identity = { source, build: String(build), revision, table: schema.name };
        this._tables.set(schema.name, { schema, service, identity });
        return this;
    }

    /**
     * Resolve the names of all registered tables while the database is open.
     * @returns {Promise<string[]>}
     * @cjs
     */
    async List()
    {
        this._AssertOpen();
        return [...this._tables.keys()];
    }

    /**
     * Description and provenance are owned copies; inspecting a table does not load it.
     * @param {string} name Member or registration name.
     * @returns {Promise<object>}
     * @cjs
     */
    async Describe(name)
    {
        const table = this._Table(name);
        return structuredClone({ ...table.schema, identity: table.identity });
    }

    /**
     * Query one primary-key record and validate its returned identity.
     * @param {string} name Member or registration name.
     * @param {string|number} id Primary-key identity.
     * @returns {Promise<object|null>}
     * @cjs
     */
    async GetByID(name, id)
    {
        const table = this._Table(name);
        const keys = table.schema.columns.filter(column => column.primaryKey);
        if (keys.length !== 1) throw new Error("GetByID requires exactly one declared primary key");
        if (typeof id !== "string" && !Number.isSafeInteger(id)) throw new TypeError("ID must be a string or safe integer");
        const result = await this._services.Get(table.service).GetByID(structuredClone(table.identity), id);
        if (result === undefined) throw new TypeError("Provider returned undefined instead of a record or null");
        if (result !== null && result[keys[0].name] !== id) throw new Error("Provider returned the wrong record identity");
        return structuredClone(result);
    }

    /**
     * Bounded, structured query. Providers must reject unsupported predicates.
     * @param {string} name Member or registration name.
     * @param {object} [query] Bounded filters, cursor and limit.
     * @returns {Promise<object>}
     * @cjs
     */
    async Find(name, query = {})
    {
        const table = this._Table(name);
        const request = structuredClone(query);
        const allowed = new Set(["limit", "cursor", "filters"]);
        for (const key of Object.keys(request)) if (!allowed.has(key)) throw new TypeError(`Unsupported query option ${key}`);
        request.limit ??= 100;
        request.cursor ??= null;
        request.filters ??= [];
        if (!Number.isSafeInteger(request.limit) || request.limit < 1 || request.limit > 1000)
            throw new RangeError("Query limit must be between 1 and 1000");
        if (request.cursor !== null && typeof request.cursor !== "string") throw new TypeError("Cursor must be a string or null");
        if (!Array.isArray(request.filters)) throw new TypeError("Filters must be an array");
        const fields = new Set(table.schema.columns.map(column => column.name));
        for (const filter of request.filters)
        {
            if (!filter || !fields.has(filter.field) || !["eq", "ne", "lt", "lte", "gt", "gte", "in"].includes(filter.operator))
                throw new TypeError("Invalid filter field or operator");
            if (filter.value === undefined || (filter.operator === "in" && !Array.isArray(filter.value)))
                throw new TypeError("Invalid filter value");
        }
        const result = await this._services.Get(table.service).Find(structuredClone(table.identity), request);
        if (!result || !Array.isArray(result.entries) || result.entries.length > request.limit ||
            (result.nextCursor !== null && typeof result.nextCursor !== "string"))
            throw new TypeError("Provider returned an invalid or unbounded page");
        return structuredClone({ ...result, identity: table.identity });
    }

    /**
     * Reject subsequent database operations by marking the registry closed.
     * @returns {Promise<void>} Completion of the operation.
     * @cjs
     */
    async Close()
    {
        this._closed = true;
    }

    /**
     * Reject operations after the registry has closed.
     * @cjs
     */
    _AssertOpen()
    {
        if (this._closed) throw new Error("Database is closed");
    }

    /**
     * Resolve a registered table or reject an unknown name or closed registry.
     * @param {string} name Member or registration name.
     * @returns {object}
     * @cjs
     */
    _Table(name)
    {
        this._AssertOpen();
        const table = this._tables.get(name);
        if (!table) throw new Error(`Unknown table ${name}`);
        return table;
    }

    /**
     * Stable identity for diagnostics and registration.
     * @type {string}
     * @cjs
     */
    static className = "TnyDatabase";

}

