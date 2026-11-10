import { CjsSchema } from "#schema";
import { CjsLibrary } from "../../core/CjsLibrary.js";
import { EveSpaceObject2 } from "../../trinity/eve/spaceObject/EveSpaceObject2.js";
import { Tr2ExternalParameter } from "../../trinity/core/binding/Tr2ExternalParameter.js";
import { TnyControllers } from "./TnyControllers.js";

/**
 * The dirt level for weeks since a ship was last cleaned. Ours, client
 * behaviour as found in ccpwgl (EveSpaceObject2.getdirtLevelFromWeeks); Carbon
 * only consumes m_dirtLevel. Moved here from Graphene's TrinityShipAge.
 *
 * @param {number} weeks Weeks since the last clean.
 * @returns {number} The dirt level, never below 0.
 */
export function dirtLevelFromWeeks(weeks)
{
    return Math.max(0.7 - 1 / (Math.pow(Math.max(weeks, 0), 0.65) + 1 / 2.7), 0);
}

/**
 * Application convenience for a live space object acquired through the shared
 * library. Ours: ccpwgl's TnySpaceObject (our own code there) is the shape.
 * Subclasses narrow the native class they borrow; `fetch` on a subclass
 * requires that class.
 */
export class TnySpaceObject
{
    static className = "TnySpaceObject";

    /** The native class this wrapper borrows. */
    static wrappedClass = EveSpaceObject2;

    /** Its registered name, for errors. */
    static wrappedName = "EveSpaceObject2";

    /**
     * The user-level parameters of every space object (tny.md, operator
     * 2026-11-07). Each names the native member it drives where one exists.
     * `available` limits one to objects that support it; `read`/`write`
     * delegate to the native owner.
     */
    static parameters = [
        { name: "dirtLevel", type: "number", min: 0, max: 1,
            read: o => o.wrapped.dirtLevel, write: (o, v) => o._Bind(o.wrapped, "dirtLevel").SetValue(v) },
        // Ours, client behaviour as found in ccpwgl (EveSpaceObject2.getdirtLevelFromWeeks,
        // src/eve/object/EveSpaceObject2.js:2985-2990; Graphene TrinityShipAge): weeks to dirtLevel.
        { name: "age", type: "number", min: 0, max: 520,
            read: o => o._age, write: (o, v) => { o._age = v; o.SetParameter("dirtLevel", dirtLevelFromWeeks(v)); } },
        { name: "activationStrength", type: "number", min: 0, max: 1,
            read: o => o.wrapped.activationStrength, write: (o, v) => o._Bind(o.wrapped, "activationStrength").SetValue(v) },
        // Damage taken, 0 to 1, over the core damage overlays: SetImpactDamageState takes the
        // remaining shield, armour and hull (EveSpaceObject2.SetImpactDamageState).
        ...[ "shieldDamage", "armorDamage", "hullDamage" ].map((name, index) => ({ name, type: "number", min: 0, max: 1,
            read: o => o._damage[index], write: (o, v) => { o._damage[index] = v; o._ApplyDamage(); } })),
        // Module animations on the impact overlay (EveSpaceObject2.SetImpactAnimation), by their native names.
        ...[ "shieldboost", "shieldhardening", "armorhardening", "armorrepair", "hullrepair" ].map(name => ({ name, type: "boolean",
            read: o => o._animations.has(name),
            write: (o, v) => { if (v) o._animations.add(name); else o._animations.delete(name); o.wrapped.SetImpactAnimation(name, v, TnySpaceObject.ANIMATION_DURATION); } }))
    ];

    /** Seconds a module animation fades over (a quarter of it); Graphene's demo value. */
    static ANIMATION_DURATION = 4;

    /** Existing object graph; wrapping neither copies nor initializes it. */
    wrapped = null;

    /** What the object's controllers expose (TnyControllers). */
    get controllers()
    {
        return this._controllers ??= new TnyControllers(this);
    }

    /** Built on first use. */
    _controllers = null;

    /** Weeks for the `age` parameter. */
    _age = 0;

    /** Shield, armour and hull damage taken, 0 to 1. */
    _damage = [ 0, 0, 0 ];

    /** Module animations switched on. */
    _animations = new Set();

    /** Tr2ExternalParameter bindings by target and attribute, built on first write. */
    _bindings = new Map();

    /**
     * The parameters this object supports, for a UI to list.
     *
     * @returns {{name: string, type: string, min?: number, max?: number}[]} Descriptors.
     */
    GetParameters()
    {
        return this.constructor.parameters
            .filter(parameter => !parameter.available || parameter.available(this))
            .map(({ name, type, min, max }) => ({ name, type, ...(min === undefined ? {} : { min, max }) }));
    }

    /**
     * Reads one parameter.
     *
     * @param {string} name A name from GetParameters.
     * @returns {number|boolean} Its value.
     */
    GetParameter(name)
    {
        return this._Parameter(name).read(this);
    }

    /**
     * Writes one parameter through its native owner.
     *
     * @param {string} name A name from GetParameters.
     * @param {number|boolean} value A number within its range, or a boolean.
     */
    SetParameter(name, value)
    {
        const parameter = this._Parameter(name);
        if (parameter.type === "boolean")
        {
            if (typeof value !== "boolean") throw new TypeError(`${name} takes a boolean.`);
        }
        else if (!Number.isFinite(value) || value < parameter.min || value > parameter.max)
        {
            throw new RangeError(`${name} takes a number from ${parameter.min} to ${parameter.max}.`);
        }
        else if (parameter.type === "integer" && !Number.isInteger(value))
        {
            throw new RangeError(`${name} takes a whole number.`);
        }
        parameter.write(this, value);
    }

    /** The descriptor for a supported parameter. */
    _Parameter(name)
    {
        const parameter = this.constructor.parameters.find(entry => entry.name === name);
        if (!parameter || (parameter.available && !parameter.available(this)))
            throw new RangeError(`${this.constructor.className} has no parameter ${name}.`);
        return parameter;
    }

    /** Pushes the damage taken to the impact overlay as remaining shield, armour and hull. */
    _ApplyDamage()
    {
        const [ shield, armor, hull ] = this._damage;
        this.wrapped.SetImpactDamageState(1 - shield, 1 - armor, 1 - hull, true);
    }

    /**
     * A Carbon Tr2ExternalParameter on one member, whose SetValue converts and
     * notifies the owner (Tr2ExternalParameter.cpp:137-163), as Graphene's
     * editor writes these members.
     */
    _Bind(target, attribute)
    {
        let byAttribute = this._bindings.get(target);
        if (!byAttribute) this._bindings.set(target, byAttribute = new Map());
        let binding = byAttribute.get(attribute);
        if (!binding)
        {
            binding = new Tr2ExternalParameter();
            binding.SetName(attribute);
            binding.SetDestinationObject(target);
            binding.SetDestinationAttribute(attribute);
            byAttribute.set(attribute, binding);
        }
        return binding;
    }

    /** Borrows a compatible live object without initializing or copying it. */
    constructor(wrapped)
    {
        const { wrappedClass, wrappedName, className } = this.constructor;
        if (!CjsSchema.cast(wrapped, wrappedClass)) throw new TypeError(`${className} requires a live ${wrappedName}.`);
        this.wrapped = wrapped;
    }

    /**
     * Acquires a fresh object through the library and starts its existing
     * controllers. The library owns DNA hydration and the resource wait; this
     * does not initialize the graph again. Fetch and controller failures reject.
     *
     * @param {object} options What to fetch.
     * @param {string} [options.dna] DNA; give this or `resPath`.
     * @param {string} [options.resPath] Object resource path; give this or `dna`.
     * @param {boolean} [options.awaitResources=false] Resolve once the object's resources have loaded.
     * @param {string} [options.name] Sets the object's `name`.
     * @returns {Promise<TnySpaceObject>} An instance of the class it was called on.
     */
    static async fetch(options = {})
    {
        return this.fromWrapped(await TnySpaceObject.acquire(options), options);
    }

    /**
     * Wraps an acquired object in this class, sets its name and starts its controllers.
     *
     * @param {object} object The live object.
     * @param {{name?: string|null}} [options] Fetch options.
     * @returns {TnySpaceObject} The wrapper.
     */
    static fromWrapped(object, { name = null } = {})
    {
        const wrapper = new this(object);
        if (name !== null) wrapper.wrapped.name = name;
        wrapper.wrapped.StartControllers();
        return wrapper;
    }

    /**
     * The object's world-space bounding sphere, through the native bounds
     * (`UpdateWorldBounds`, `GetBoundingSphere`), or null while it has none.
     *
     * @returns {{centre: number[], radius: number}|null} The sphere.
     */
    GetBoundingSphere()
    {
        this.wrapped.UpdateWorldBounds();
        const sphere = new Float32Array(4);
        if (!this.wrapped.GetBoundingSphere(sphere, 0)) return null;
        return { centre: [ sphere[0], sphere[1], sphere[2] ], radius: sphere[3] };
    }

    /**
     * Validates fetch options and acquires the object through the library.
     *
     * @param {object} options See `fetch`.
     * @returns {Promise<object|null>} The live object.
     */
    static async acquire({ dna = null, resPath = null, awaitResources = false, name = null, ...unknown } = {})
    {
        const library = CjsLibrary.instance;
        if (!library) throw new Error(`${this.className} requires an initialized CjsLibrary.`);
        const extra = Object.keys(unknown);
        if (extra.length) throw new TypeError(`${this.className}.fetch does not take ${extra.join(", ")}.`);
        const source = dna ?? resPath;
        if (typeof source !== "string" || !source || (dna !== null && resPath !== null))
            throw new TypeError(`${this.className} requires DNA or an object path.`);
        if (name !== null && typeof name !== "string") throw new TypeError(`${this.className} name must be a string.`);
        return library.Fetch(source, { awaitResources });
    }
}
