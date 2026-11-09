import { CjsSchema } from "../../blue/schema/CjsSchema.js";
import { getResourceExtension, normalizeResourcePath } from "#utils/path";
import { CjsLoadingObject } from "../../blue/resman/CjsLoadingObject.js";
import { CjsYamlFormat } from "../../resource/formats/yaml/CjsYamlFormat.js";
import { CjsYamlReader } from "../../resource/formats/yaml/core/CjsYamlReader.js";
import { createCharacterYamlTagHandlers, normalizeCharacterYamlValues } from "./yaml.js";

/**
 * Caches one character YAML parse and creates fresh typed records per LoadObject.
 * Identification is separate from construction, as in the static format route.
 * It does not build characters or acquire any referenced resource. It holds no table of its own: its caller hands it
 * the configuration that declares the files it reads, `{ kinds, sourceLists }` (the parts library's
 * `CjsCharacterLibraryConfiguration`; the character factory's `CjsCharacterFactory.recipeConfiguration`).
 */
export class CjsCharacterObjectBuilder
{
    _reader = null;

    _kind = "";

    _path = "";

    /** The caller's configuration: its kinds and their list forms. @type {{ kinds: Object<string, object>, sourceLists: Object<string, Object<string, string[]>> }} */
    _configuration = null;

    /** Weak source associations retain authored presence without polluting data classes. */
    static _sources = new WeakMap();

    /**
     * Parses one already acquired source with its configured family.
     * @param {string|ArrayBuffer|ArrayBufferView} bytes Original YAML input.
     * @param {string} kind Configured source family.
     * @param {string} path Original logical source path.
     * @param {{ kinds: Object<string, object>, sourceLists: Object<string, Object<string, string[]>> }} configuration
     *   The kinds the caller reads (`className`, `envelope`, `items`: the class of an envelope list's mapping
     *   entries) and their list forms (`normalizeCharacterYamlValues`).
     * @param {object} [options={}] YAML reader options, including an alias bound.
     */
    constructor(bytes, kind, path, configuration, options = {})
    {
        this._kind = kind;
        this._path = path;
        this._configuration = configuration;
        const format = new CjsYamlFormat({
            ...options,
            sourceName: path,
            tagPolicy: "handle",
            tagHandlers: createCharacterYamlTagHandlers(configuration.sourceLists),
            maxAliasCount: options.maxAliasCount ?? 100000,
            // Two published sculpting-limit files repeat keys. Keep the full AST;
            // the existing YAML conversion uses the last value when explicitly allowed.
            uniqueKeys: options.uniqueKeys ?? kind !== "sculptingLimits"
        });
        this._reader = new CjsYamlReader(bytes, format.GetValues());
        this._reader.AssertSyntax();
        this._reader.AssertAliasLimit();
    }

    /**
     * Creates a detached object through the existing values transport.
     * @param {number} [objectMarker=0] IBlueObjectBuilder root marker; only zero applies.
     * @returns {object} The configured source class, with authored references intact.
     */
    CreateObject(objectMarker = 0)
    {
        if (objectMarker !== 0) throw new RangeError("Character text has only its root object marker.");
        let raw = this._reader.ReadRaw();
        const { sourceLists } = this._configuration;
        const identified = CjsCharacterObjectBuilder.inspect(raw, this._kind, this._configuration.kinds);
        const Constructor = CjsSchema.getConstructor(identified.className);
        if (!Constructor) throw new TypeError(`Character kind ${identified.kind} requires registered ${identified.className}.`);
        if (identified.kind === "lights") raw = ReadTypeRecords(raw, sourceLists);
        if (identified.items)
        {
            // An envelope list whose mappings are records of its declared class (a recipe's modifiers); its other
            // entries (a recipe's leading sex) stay as written.
            const Item = CjsSchema.getConstructor(identified.items);
            if (!Item) throw new TypeError(`Character kind ${identified.kind} requires registered ${identified.items}.`);
            raw = raw.map(entry =>
            {
                if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return entry;
                const item = new Item();
                CjsSchema.setValues(item, normalizeCharacterYamlValues(Item, entry, sourceLists), { initialize: false });
                return item;
            });
        }
        const existing = CjsSchema.cast(raw, Constructor);
        const object = existing || new Constructor();
        if (!existing)
        {
            const values = identified.envelope ? { name: this._path, value: raw } : raw;
            CjsSchema.assertValues(values, identified.className);
            CjsSchema.setValues(object, normalizeCharacterYamlValues(Constructor, values, sourceLists), { initialize: false });
        }
        CjsCharacterObjectBuilder._sources.set(object, { builder: this, kind: identified.kind });
        return object;
    }

    /**
     * Returns the cached source document for the inverse format mapping.
     * @returns {import("yaml").Document} Parsed source; callers must clone before editing.
     */
    GetSourceDocument()
    {
        return this._reader.document;
    }

    /** Returns the logical source identity without normalizing authored field values. */
    GetPath()
    {
        return this._path;
    }

    /**
     * The `ex` the character `.yaml` kinds load under: a character `.yaml` routes as `.yaml` + `character`,
     * so plain `.yaml` stays the generic reader's.
     *
     * Ours (non-carbon-extensions.md § *The shared character library*; Ruru, 2026-11-01): Carbon's `ex` is a
     * resource factory suffix; the character `.yaml` files have no extension of their own to register.
     */
    static ex = "character";

    /**
     * The extensions a configuration's text kinds register under: each kind's own extension (`color`, `type`,
     * `proj`, ...), and `.yaml` + `ex` for the `.yaml` kinds and the files without an extension.
     * @param {{ kinds: Object<string, object>, getRows: function(): Array<{match: string, kind: string}> }} configuration
     *   The kinds and their path rows (`CjsCharacterLibraryConfiguration`).
     * @returns {string[]} Normalized registration extensions.
     */
    static getExtensions(configuration)
    {
        const extensions = new Set();
        for (const row of configuration.getRows())
        {
            if (configuration.kinds[row.kind].pathOnly) continue;
            extensions.add(CjsCharacterObjectBuilder.getRouteExtension(row.match.slice(row.match.lastIndexOf("/") + 1)));
        }
        return [ ...extensions ].sort();
    }

    /**
     * The registration extension a character source loads under: its own, or `yaml` + `ex` for `.yaml` and
     * extension-less files.
     * @param {string} path A source path or file pattern.
     * @returns {string} The normalized registration extension.
     */
    static getRouteExtension(path)
    {
        const extension = getResourceExtension(path).toLowerCase();
        return !extension || extension === "yaml" ? "yaml" + CjsCharacterObjectBuilder.ex : extension;
    }

    /**
     * The resMan LoadObject options that route a character source to its object builder.
     * @param {string} path The source path.
     * @returns {{ext?: string, ex?: string}} Empty for a kind with its own extension.
     */
    static getLoadOptions(path)
    {
        return CjsCharacterObjectBuilder.getRouteExtension(path) === "yaml" + CjsCharacterObjectBuilder.ex
            ? { ext: ".yaml", ex: CjsCharacterObjectBuilder.ex }
            : {};
    }

    /**
     * Registers the character object builder for every text extension of a configuration on a resMan
     * (`getExtensions`). Each build asks `kindOf` which configured kind the path is.
     *
     * Ours (non-carbon-extensions.md § *The shared character library*): the character formats register
     * themselves, as Carbon modules register their own extensions (`BLUE_REGISTER_RESOURCE_EXTENSION`,
     * `IBlueResMan.h:151`); `CjsCharacterLibraryManager.Initialize` calls this with the library's configuration.
     *
     * @param {object} resMan The resource manager.
     * @param {function(string): (string|null)} kindOf A canonical source path's configured kind, or null.
     * @param {{ kinds: Object<string, object>, sourceLists: Object<string, Object<string, string[]>>, getRows: function(): Array<{match: string, kind: string}> }} configuration
     *   The kinds, their list forms and their path rows (`CjsCharacterLibraryConfiguration`).
     * @returns {void}
     */
    static registerObjectBuilders(resMan, kindOf, configuration)
    {
        const create = (bytes, context) =>
        {
            const path = normalizeResourcePath(context.path);
            const kind = kindOf(path);
            if (!kind) throw new TypeError(`No configured character source for ${path}`);
            return new CjsCharacterObjectBuilder(bytes, kind, path, configuration);
        };
        for (const extension of CjsCharacterObjectBuilder.getExtensions(configuration)) resMan.RegisterObjectBuilder(extension, create);
        // LoadObject consults a bare object builder only without an ex (BlueResMan LoadObject), so the .yaml + ex
        // route is an explicit object route over the builder just registered. Its builder answers the object, so
        // the route's Identify is never reached; it keeps the values as they are.
        resMan.RegisterExtension("yaml" + CjsCharacterObjectBuilder.ex, CjsLoadingObject, { Identify: () => true });
    }

    /**
     * Identifies an observed layout without constructing or routing objects.
     * @param {*} value Parsed YAML value.
     * @param {string} kind Configured source family.
     * @param {Object<string, object>} kinds The caller's kind declarations.
     * @returns {{kind:string,className:string,envelope?:boolean,items?:string}} Identified declaration.
     */
    static inspect(value, kind, kinds)
    {
        let selected = kind;
        if (kind === "cameras" && Array.isArray(value))
        {
            if (value.length !== 6) throw new TypeError("A positional character camera requires six source slots.");
            selected = "cameraSequences";
        }
        if (kind === "posts")
        {
            if (typeof value?.lut === "string" && typeof value.lut_influence === "number") selected = "scalarPosts";
            else if (typeof value?.lut !== "boolean" || !Array.isArray(value.lut_influence))
            {
                throw new TypeError("Unrecognized character post layout.");
            }
        }
        const declaration = kinds[selected];
        if (!declaration || declaration.pathOnly) throw new TypeError(`Character YAML has no text kind ${selected}.`);
        return { kind: selected, ...declaration };
    }

    /**
     * Finds the original layout for one loaded record without retaining the record.
     * @param {object} object Record returned by this builder.
     * @returns {{builder:CjsCharacterObjectBuilder,kind:string}|null} Source association.
     */
    static getSource(object)
    {
        return this._sources.get(object) || null;
    }
}

/**
 * Hydrates the existing light YAML's native type records without initialization.
 * @param {*} value Parsed light source value.
 * @param {Object<string, Object<string, string[]>>} sourceLists The caller's list forms, by record class.
 * @param {Map<object,object>} [memo=new Map()] Source aliases already encountered.
 * @returns {*} Converted value, preserving aliases and scalar spelling.
 */
function ReadTypeRecords(value, sourceLists, memo = new Map())
{
    if (!value || typeof value !== "object") return value;
    if (memo.has(value)) return memo.get(value);
    if (Array.isArray(value))
    {
        const result = [];
        memo.set(value, result);
        for (const item of value) result.push(ReadTypeRecords(item, sourceLists, memo));
        return result;
    }
    const name = typeof value.type === "string" ? value.type : "";
    const Constructor = name ? CjsSchema.getConstructor(name) : null;
    if (name && !Constructor) throw new TypeError(`Unregistered light YAML type ${name}.`);
    const result = Constructor ? new Constructor() : Object.create(null);
    memo.set(value, result);
    const values = Object.fromEntries(Object.entries(value)
        .filter(([ key ]) => key !== "type")
        .map(([ key, child ]) => [ key, ReadTypeRecords(child, sourceLists, memo) ]));
    if (Constructor) CjsSchema.setValues(result, normalizeCharacterYamlValues(Constructor, values, sourceLists), { initialize: false });
    else Object.assign(result, values);
    return result;
}
