// The thin adapter between Black's reader and today's schema. BlackReader asks
// it what a class is; it answers with one compiled record per class. When the
// compiled definitions from step 6 of the Blue plan exist, this file is the only
// thing that changes: the reader keeps asking the same questions.
//
// It reuses CjsBlackSchemaRegistry's mapping from a declared type to a VARTYPE, so
// the port and today's reader cannot disagree on what a declaration means.
import { CjsSchema } from "#schema";
import { VARTYPE } from "../../../global/model/graph/GraphTypes.js";
import { mappedInterfaces } from "../../compose/interface.js";
import { ICustomPersist } from "../../exposure/ICustomPersist.js";
import { IInitialize } from "../../exposure/IInitialize.js";
import { INotify } from "../../exposure/INotify.js";
import { IBlueObjectProxy } from "../../interfaces/IBlueObjectProxy.js";
// CjsBlackReader first: it and the registry import each other, and it is the entry that resolves.
import "./core/CjsBlackReader.js";
import { CjsBlackPropertyReaders } from "./core/CjsBlackPropertyReaders.js";
import { CjsBlackSchemaRegistry } from "./core/CjsBlackSchemaRegistry.js";

/**
 * What an IROOT member is. Carbon casts the destination to find out; a plain
 * record, and plain JavaScript storage, cannot be cast.
 *
 * @enum {number}
 */
export const BLACK_DESTINATION = Object.freeze({
    OBJECT: 0,
    LIST: 1,
    ARRAY: 2,
    SET: 3,
    DICT: 4,
    STRUCTURELIST: 5,
    WRAPPER: 6
});

/**
 * @typedef {object} BlackEntry A compiled member: Carbon's `Be::VarEntry`, located by key.
 * @property {string} name `mName`.
 * @property {string} key The JavaScript key that stands in for `mOffset`.
 * @property {number} index An element of the array at `key`, or -1.
 * @property {number} type `mType`, a VARTYPE; INVALID when no VARTYPE is known.
 * @property {boolean} notify Whether `mEditFlags` has NOTIFY.
 * @property {boolean} isProperty Whether a setter takes the value.
 * @property {boolean} signed The sign of a BYTE or SHORT, which Carbon's member type gives.
 * @property {number} floatArraySize Carbon's `GetFloatArraySize`.
 * @property {Function[]} iids `mIID`, as the accepted classes that are registered; empty means any object.
 * @property {number} destination What an IROOT member is: a BLACK_DESTINATION.
 * @property {boolean} keepsNulls Whether a list of this kind keeps null items.
 * @property {object|null} structure A structure list's layout.
 * @property {string[]|null} wrapperElements A math member's persisted element names.
 * @property {string|null} wrapperClass A math member's wire class.
 * @property {number[]|null} wrapperDefaults A math member's elements before the file sets any.
 */

/**
 * @typedef {object} BlackDefinition A compiled class: Carbon's `Be::ClassInfo`, as the reader asks it.
 * @property {Function} Constructor The class.
 * @property {string} className Its registered name.
 * @property {Map<string, BlackEntry>} entries PERSIST members by name.
 * @property {boolean} isInitialize Whether it maps IInitialize.
 * @property {boolean} isNotify Whether it maps INotify.
 * @property {boolean} isProxy Whether it is an IBlueObjectProxy.
 * @property {boolean} isCustomPersist Whether it maps ICustomPersist.
 */

/** Compiled classes by constructor. */
const DEFINITIONS = new Map();

/**
 * Asks whether a class provides an interface, mapped or inherited.
 *
 * @param {Set<Function>} mapped The class's mapped interfaces.
 * @param {Function} Constructor The class.
 * @param {Function} Interface The interface.
 * @returns {boolean} True when it provides it.
 */
function provides(mapped, Constructor, Interface)
{
    return mapped.has(Interface) || Interface.prototype.isPrototypeOf(Constructor.prototype);
}

/**
 * The adapter over today's schema. Modelled on: Be::ClassInfo and Be::VarEntry
 * (blueexposure/include/BlueTypes.h:321-375).
 */
export class CjsBlackDefinitions
{
    /** Registered name; `constructor.name` does not survive minification. */
    static className = "CjsBlackDefinitions";

    /**
     * The compiled class of a constructor.
     *
     * @param {Function} Constructor The class.
     * @returns {BlackDefinition} Its compiled record.
     */
    static get(Constructor)
    {
        let definition = DEFINITIONS.get(Constructor);
        if (definition === undefined)
        {
            definition = CjsBlackDefinitions.compile(Constructor);
            DEFINITIONS.set(Constructor, definition);
        }
        return definition;
    }

    /**
     * The compiled class registered under a name, aliases included.
     *
     * @param {string} name The class name in the file.
     * @returns {BlackDefinition|null} Its compiled record, or null when no class is registered.
     */
    static fromName(name)
    {
        const Constructor = CjsSchema.getConstructor(name);
        return Constructor ? CjsBlackDefinitions.get(Constructor) : null;
    }

    /**
     * Compiles one class. Members win over properties and the first name wins,
     * as `CjsBlackSchemaRegistry.fromClassInfo` selects them; a runtime-only
     * declaration claims its name without being read.
     *
     * @param {Function} Constructor The class.
     * @returns {BlackDefinition} The record.
     */
    static compile(Constructor)
    {
        const info = CjsSchema.getSchema(Constructor);
        const entries = new Map();
        const claimed = new Set();

        for (const declaration of [ ...info.members, ...info.properties ])
        {
            if (claimed.has(declaration.name)) continue;
            if (declaration.type?.runtimeOnly === true)
            {
                claimed.add(declaration.name);
                continue;
            }
            // PERSISTONLY carries Be::PERSIST in Carbon, so FindEntry finds it.
            if (!declaration.edit?.persist && !declaration.edit?.persistOnly) continue;
            claimed.add(declaration.name);
            entries.set(declaration.name, CjsBlackDefinitions.compileEntry(declaration));
        }

        const mapped = mappedInterfaces(Constructor);
        return {
            Constructor,
            className: info.className,
            entries,
            isInitialize: provides(mapped, Constructor, IInitialize),
            isNotify: provides(mapped, Constructor, INotify),
            isProxy: provides(mapped, Constructor, IBlueObjectProxy),
            isCustomPersist: provides(mapped, Constructor, ICustomPersist)
        };
    }

    /**
     * Compiles one member. A type with no VARTYPE compiles to INVALID, so
     * reading it gives Carbon's "Invalid attribute type".
     *
     * @param {object} declaration The schema's declaration.
     * @returns {BlackEntry} The entry.
     */
    static compileEntry(declaration)
    {
        const { type } = declaration;
        let black = null;
        try
        {
            black = CjsBlackSchemaRegistry.fromDeclaredType(type).black;
        }
        catch (error)
        {
            if (error.name !== "TypeError") throw error;
        }

        const entry = {
            name: declaration.name,
            key: declaration.key,
            index: declaration.index ?? -1,
            type: black === null ? VARTYPE.INVALID : VARTYPE[black.beType],
            notify: declaration.edit?.notify === true,
            isProperty: declaration.role === "property",
            signed: black?.signed === true,
            floatArraySize: black?.length ?? 0,
            iids: [],
            destination: BLACK_DESTINATION.OBJECT,
            keepsNulls: type?.kind === "array",
            structure: null,
            wrapperElements: null,
            wrapperClass: null,
            wrapperDefaults: null
        };

        if (black === null) return entry;

        for (const accepted of type?.accepts ?? (type?.className ? [ type.className ] : []))
        {
            const Class = typeof accepted === "function" ? accepted : CjsSchema.getConstructor(accepted);
            if (Class) entry.iids.push(Class);
        }

        if (black.wrapped)
        {
            entry.destination = BLACK_DESTINATION.WRAPPER;
            entry.wrapperClass = black.wrapped;
            const layout = CjsBlackPropertyReaders.getWrapperLayout(black.wrapped, type.kind);
            entry.wrapperElements = layout.elements;
            entry.wrapperDefaults = layout.defaults;
        }
        else if (type?.kind === "structList")
        {
            entry.destination = BLACK_DESTINATION.STRUCTURELIST;
            entry.structure = CjsBlackDefinitions.compileStructure(black);
        }
        else if (type?.kind === "list")
        {
            entry.destination = BLACK_DESTINATION.LIST;
        }
        else if (type?.kind === "array")
        {
            entry.destination = BLACK_DESTINATION.ARRAY;
        }
        else if (type?.kind === "set")
        {
            entry.destination = BLACK_DESTINATION.SET;
        }
        else if (type?.kind === "map")
        {
            entry.destination = BLACK_DESTINATION.DICT;
        }

        return entry;
    }

    /**
     * Compiles a structure list's layout. Each record field becomes an entry,
     * so the handlers read it as they read a member.
     *
     * @param {object} black The registry's wire description of the member.
     * @returns {{size: number, boundaries: number[], Item: Function, fields: BlackEntry[]}} The layout.
     */
    static compileStructure(black)
    {
        const { structure, itemClassName } = black;
        const Item = typeof itemClassName === "function" ? itemClassName : CjsSchema.getConstructor(itemClassName);
        const declarations = new Map();
        for (const member of CjsSchema.getSchema(Item).members)
        {
            if (member.role === "member" && !declarations.has(member.name)) declarations.set(member.name, member);
        }

        const fields = structure.members.map(member => ({
            ...CjsBlackDefinitions.compileEntry({
                name: member.name,
                key: declarations.get(member.name).key,
                index: declarations.get(member.name).index,
                role: "member",
                type: { kind: member.type }
            }),
            offset: member.offset
        }));

        return { size: structure.size, boundaries: structure.boundaries ?? [], Item, fields };
    }
}
