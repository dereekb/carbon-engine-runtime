import { CjsSchema, meta, type } from "#schema";
import { CjsGraphRoot } from "../../global/model/graph/CjsGraphRoot.js";
import { INotify } from "../../blue/exposure/INotify.js";
import { Copier } from "../../blue/exposure/Copier.js";
import { CjsBlueGraph } from "../../blue/formats/graph/CjsBlueGraph.js";
import { blue } from "../../blue/index.js";
import { CjsLibrary } from "../../core/CjsLibrary.js";
import { EveTurretSet } from "../../trinity/eve/attachment/turrets/EveTurretSet.js";
import { EveSpaceObject2 } from "../../trinity/eve/spaceObject/EveSpaceObject2.js";

/** Weapon locators by family, as Graphene's fitting groups them: `locator_turret_3a` is turret slot 3. */
const LOCATOR = /^locator_(turret|launcher|missile|xl|atomic|chain|bomb)_(\d+)[a-z]$/i;
const FAMILIES = { turret: "turrets", launcher: "launchers", missile: "launchers", xl: "xlTurrets", atomic: "atomics", chain: "chains", bomb: "bombs" };

/**
 * One weapon slot on a mobile object: the authored locators of one family and
 * number (`locator_turret_1a`, `locator_turret_1b`, ...). Ours, after ccpwgl's
 * TnySlot and Graphene's TrinityFitting (our own code in both). Writing
 * `resPath` mounts or (with "") unmounts; the actions are methods.
 */
@meta.define({ className: "TnySlot" })
@meta.mapInterface(INotify)
export class TnySlot extends CjsGraphRoot
{
    /** "turrets", "launchers", "xlTurrets", "atomics", "chains" or "bombs". */
    @meta.mapAttribute(meta.READ)
    @type.string
    family = "";

    /** The slot number in its family. */
    @meta.mapAttribute(meta.READ)
    @type.int32
    number = 0;

    /** How many locators (turret mounts) the slot has. */
    @meta.mapAttribute(meta.READ)
    @type.int32
    mounts = 0;

    /** The locator name prefix the turret set binds to (`locator_turret_`). */
    @meta.mapAttribute(meta.READ)
    @type.string
    locatorName = "";

    /** The mounted EveTurretSet's resource path; "" when empty. Writing it mounts or unmounts. */
    @meta.mapAttribute(meta.READWRITE | meta.NOTIFY)
    @type.string
    resPath = "";

    /** A SOF faction for the weapon's colours; "" paints it with the ship's DNA. */
    @meta.mapAttribute(meta.READWRITE | meta.NOTIFY)
    @type.string
    faction = "";

    /** The TnyMobile this slot belongs to. */
    owner = null;

    /** Called with a member's name once the slot handled a change; set by a UI. */
    _onModified = null;

    /** The slot's EveTurretSet; an empty, hidden one reserves the slot's place. */
    _set = null;

    /** The path actually mounted. */
    _mounted = "";

    /** Increases on each mount or unmount, so a slower earlier mount does not land. */
    _generation = 0;

    /**
     * Groups an object's weapon locators into slots, ordered by family and number.
     *
     * @param {import("./TnyMobile.js").TnyMobile} owner The wrapper.
     * @returns {TnySlot[]} The slots.
     */
    static discover(owner)
    {
        const slots = new Map();
        for (const locator of owner.wrapped.locators)
        {
            const match = LOCATOR.exec(locator.GetName());
            if (!match) continue;
            const id = `locator_${match[1]}_${match[2]}`;
            if (!slots.has(id)) slots.set(id, Object.assign(new TnySlot(), { owner, family: FAMILIES[match[1].toLowerCase()], number: Number(match[2]), locatorName: `locator_${match[1]}_` }));
            slots.get(id).mounts++;
        }
        return [ ...slots.values() ].sort((a, b) => a.family.localeCompare(b.family) || a.number - b.number);
    }

    /**
     * `resPath` or `faction` changed: mount, remount or unmount, then tell the UI.
     * A failed mount is logged and `resPath` goes back to what is mounted.
     *
     * @param {string} name The member.
     * @returns {boolean} True.
     */
    OnModified(name)
    {
        if (name === "resPath" || name === "faction")
        {
            const work = this.resPath ? this._Mount(this.resPath, this.faction || null) : Promise.resolve(this._Unmount());
            work.catch(error =>
            {
                console.error(`TnySlot ${this.locatorName}${this.number} mount failed`, error);
                this.resPath = this._mounted;
                if (this._onModified) this._onModified("resPath");
            });
        }
        if (this._onModified) this._onModified(name);
        return true;
    }

    /**
     * Mounts a turret set: loads it and its firing effect through the library,
     * gives the ship its own copies, paints it with a faction or the ship's
     * DNA through the SOF, and binds it to this slot's locators.
     *
     * @returns {Promise<boolean>} False when a later change superseded this one.
     */
    async _Mount(resPath, faction)
    {
        const library = CjsLibrary.instance;
        if (!library) throw new Error("TnySlot requires an initialized CjsLibrary.");
        const generation = ++this._generation;
        const set = await this._Load(library, resPath, EveTurretSet);
        if (set.firingEffectResPath) set.SetFiringEffect(await this._Load(library, set.firingEffectResPath));
        const dna = this.owner.identity?.dna ?? null;
        if (faction) await blue.sof.SetupTurretMaterialFromFaction(set, faction);
        else if (dna) await blue.sof.SetupTurretMaterialFromDNA(set, dna);
        if (generation !== this._generation) return false;

        this._Place(set);
        this._mounted = resPath;
        set.EnterStateIdle();
        return true;
    }

    /** Takes the weapon off, leaving the slot reserved. */
    _Unmount()
    {
        ++this._generation;
        if (!this._mounted) return;
        this._set.EnterStateIdle();
        const empty = new EveTurretSet();
        empty.display = false;
        this._Place(empty);
        this._mounted = "";
    }

    /**
     * Aims the weapon at an object, or at a point near the ship when none is
     * given (Graphene's preview aims at a point eight radii out).
     *
     * @param {import("./TnySpaceObject.js").TnySpaceObject|null} [target=null] What to aim at.
     */
    SetTarget(target = null)
    {
        const set = this._Mounted();
        const aim = target ? target.wrapped : this._Point();
        if (aim === this.owner.wrapped) throw new Error("A weapon cannot target its own ship.");
        if (!set.SetTargetObject(aim)) throw new Error("The object cannot be targeted.");
        set.EnterStateTargeting();
    }

    /**
     * Fires one volley at the current target (EveTurretSet.EnterStateFiring),
     * targeting a point first if there is none.
     *
     * @returns {boolean} Whether the set entered firing.
     */
    Fire()
    {
        const set = this._Mounted();
        if (!set.GetTargetObject()) this.SetTarget();
        return set.EnterStateFiring();
    }

    /** Returns the weapon to idle. */
    Idle() { this._Mounted().EnterStateIdle(); }

    /** Plays the reload state. */
    Reload() { this._Mounted().EnterStateReloading(); }

    /** Packs the weapon away. */
    Deactivate() { this._Mounted().EnterStateDeactive(); }

    /**
     * The actions that work on this slot now, with signatures: only Mount by
     * value when empty, the weapon's actions when one is mounted.
     *
     * @returns {object} Method names to signatures.
     */
    GetMethods()
    {
        return this._mounted ? { SetTarget: "(target)", Fire: "()", Idle: "()", Reload: "()", Deactivate: "()" } : {};
    }

    /** Detaches the UI. */
    Destruct()
    {
        this._onModified = null;
    }

    /** The mounted set, or an error when the slot is empty. */
    _Mounted()
    {
        if (!this._mounted) throw new Error(`Slot ${this.locatorName}${this.number} has no weapon.`);
        return this._set;
    }

    /** Loads a resource and returns this ship's own copy (resMan shares the loaded one). */
    async _Load(library, path, Type = null)
    {
        const loaded = await library.Fetch(path);
        if (Type && !CjsSchema.cast(loaded, Type)) throw new TypeError(`${path} is not an ${CjsSchema.getClassName(Type)}.`);
        return new Copier().CloneTo(loaded);
    }

    /**
     * Puts a set in this slot's place in the ship's turretSets, reserving
     * every slot first so clearing one never moves a later weapon (native
     * non-turret mounting assigns slots by order; Graphene's Reserve).
     */
    _Place(set)
    {
        const ship = this.owner.wrapped;
        for (const slot of this.owner.slots) if (!slot._set) slot._Reserve();
        set.locatorName = this.locatorName;
        set.slotNumber = this.number;
        const index = ship.turretSets.indexOf(this._set);
        ship.turretSets.Remove(index);
        ship.turretSets.Insert(index, set);
        this._set = set;
        ship.RebuildTurretPositions();
    }

    /** Adds an empty, hidden set for this slot. */
    _Reserve()
    {
        const set = new EveTurretSet();
        set.display = false;
        set.locatorName = this.locatorName;
        set.slotNumber = this.number;
        this.owner.wrapped.turretSets.Append(set);
        this._set = set;
    }

    /** A point near the ship to aim at when no target is given. */
    _Point()
    {
        const ship = this.owner.wrapped, point = new EveSpaceObject2();
        const position = new Float32Array(3);
        ship.GetWorldPosition(position);
        position[0] += Math.max(ship.GetRadius() * 8, 1000);
        point.worldPosition.set(position);
        point.modelWorldPosition.set(position);
        point.worldTransform.set([ 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, position[0], position[1], position[2], 1 ]);
        return point;
    }
}

CjsBlueGraph.define(TnySlot, "TnySlot");
