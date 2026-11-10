import { CjsSchema } from "#schema";
import { vec3 } from "#math/vec3";
import { quat } from "#math/quat";
import { mat4 } from "#math/mat4";
import { CjsLibrary } from "../core/CjsLibrary.js";
import { EveSpaceScene } from "../trinity/eve/scene/EveSpaceScene.js";
import { Tr2RenderContext_GetMainThreadRenderContext } from "../trinity/core/context/Tr2RenderContext.js";
import { Tr2CurveCombiner } from "../trinity/curves/curve/Tr2CurveCombiner.js";
import { Tr2TranslationAdapter } from "../trinity/curves/curve/Tr2TranslationAdapter.js";
import { Tr2CurveConstant } from "../trinity/curves/curve/Tr2CurveConstant.js";
import { TnyScene } from "./TnyScene.js";
import { TnySpaceObject } from "./objects/TnySpaceObject.js";
import { TnyStationary } from "./objects/TnyStationary.js";
import { TnyShip } from "./objects/TnyShip.js";

/** Bay placements in a layout-built hangar, by size (the SOF layout placement names). */
const BAY_PLACEMENTS = { small: "small_dock_ships", medium: "medium_dock_ships" };

/** How a ship enters a bay. */
const ENTRIES = [ "docked", "dock", "appear" ];

/**
 * A station hangar: a TnyScene holding one hangar object, its ship positions
 * ("bays") and the ships in them. Ours, with no Carbon counterpart: the EVE
 * client places ships in hangars in its own code. Everything it drives is
 * content: the hangar's SOF build, the docker multi-effect and
 * `me_generic_hangar_vfx_01a`.
 *
 * Three kinds of hangar, told apart by what the built hangar holds:
 * - layout-built (Upwell, Deathless): one bay per SOF layout placement named
 *   `small_dock_ships` or `medium_dock_ships`; a docker per ship flies it in
 *   and out, dissolves it (`materialize`) and fades it in (`skinChange`);
 * - capital (`mgenh_ch01`): one bay at the hull's `ship_placement` locator,
 *   with the docker;
 * - every other hangar (racial, AIR, the older generic ones): one bay at the
 *   origin; `me_generic_hangar_vfx_01a` animates the ship.
 */
export class TnyHangar extends TnyScene
{
    static className = "TnyHangar";

    /**
     * Facts per hangar hull: its own scene and, for layout-built hangars, the
     * docker. A hull not listed gets an empty sunless scene and `DOCKER`.
     * Pairings marked DERIVED are not stated by the content: which Upwell
     * scene goes with which hangar, and the Deathless ones, are client choices.
     */
    static DEFAULTS = {
        ah1: { scene: "res:/dx9/model/hangar/amarr/ah1/ah1_scene.black" },
        ch1: { scene: "res:/dx9/model/hangar/caldari/ch1/ch1_scene.black" },
        gh1: { scene: "res:/dx9/model/hangar/gallente/gh1/gh1_scene.black" },
        mh1: { scene: "res:/dx9/model/hangar/minmatar/mh1/mh1_scene.black" },
        chjita: { scene: "res:/dx9/model/hangar/caldari/chjita/chjita_scene.black" },
        airh1: { scene: "res:/dx9/model/hangar/air/airh1/airh1_scene.black" },
        airh2: { scene: "res:/dx9/model/hangar/air/airh2/airh2_scene.black" },
        gensh1_t1a: { scene: "res:/dx9/model/hangar/generic/standard/gensh1/gensh1_scene.black" },
        gench1_t1a: { scene: "res:/dx9/model/hangar/generic/capital/gench1/gench1_scene.black" },
        // DERIVED: the Upwell scenes 01a/01b, refinery and engineering complex all fit both Upwell hulls.
        mgenh_ow01: { scene: "res:/dx9/model/hangar/modular/scene/upwell_hangar_scene_01a.black" },
        mgenh_ch01: { scene: "res:/dx9/model/hangar/modular/scene/upwell_hangar_scene_01a.black" },
        // DERIVED: which Deathless scene goes with which hull.
        mdeha01: { scene: "res:/dx9/model/hangar/modular/scene/deathless_hangar_scene_01.black",
            docker: "res:/dx9/model/hangar/shared/docker/multieffect_docker_01a_deathless.black" },
        mdeha03: { scene: "res:/dx9/model/hangar/modular/scene/deathless_hangar_scene_02.black",
            docker: "res:/dx9/model/hangar/shared/docker/multieffect_docker_01a_deathless.black" }
    };

    /** The docker for a layout-built or capital hangar whose hull lists none. */
    static DOCKER = "res:/dx9/model/hangar/shared/docker/multieffect_docker_01a.black";

    /** The effect that animates a ship in a hangar without bays. */
    static HANGAR_EFFECT = "res:/dx9/model/hangar/shared/fx/me_generic_hangar_vfx_01a.black";

    /**
     * Ours: when SetShip is given no bay, a ship whose bounding sphere is
     * smaller than this takes a small bay, otherwise a medium one. Nothing in
     * Carbon or the content chooses a bay by size; the client does.
     */
    static SMALL_SHIP_RADIUS = 100;

    static scratch = { vec3_0: vec3.create(), quat_0: quat.create() };

    /** The hangar object (TnyStationary). */
    hangar = null;

    /** "layout", "capital" or "origin": how ships are placed, from what the hangar holds. */
    kind = null;

    /** The bay the last SetShip filled, the one Undock() leaves; null before. */
    active = null;

    /** Bay records, by index. */
    _bays = [];

    /** Timers that remove dissolved ships. */
    _timers = new Set();

    /**
     * Builds a hangar from its DNA and its scene, and finds its bays.
     *
     * @param {object} options
     * @param {string} options.dna The hangar's DNA (hangars have graphicIDs, no typeIDs).
     * @param {string} [options.scene] A scene path; omitted, the hull's default, else an empty sunless scene.
     * @param {boolean} [options.awaitResources=false] Resolve once the hangar's resources have loaded.
     * @returns {Promise<TnyHangar>} The hangar scene.
     */
    static async fetch({ dna, scene, awaitResources = false } = {})
    {
        const library = CjsLibrary.instance;
        if (!library) throw new Error("TnyHangar requires an initialized CjsLibrary.");
        const object = await TnySpaceObject.acquire({ dna, awaitResources });
        const hangar = TnyStationary.fromWrapped(object, { dna });
        const path = scene ?? TnyHangar.DEFAULTS[hangar.identity.hull]?.scene ?? null;
        const result = new TnyHangar(path ? await library.Fetch(path) : TnyHangar.CreateSunlessScene());
        result.hangar = hangar;
        result.AddObject(hangar);
        result._FindBays();
        return result;
    }

    /** An empty space scene with the sun off: the hangar's own lights light it. */
    static CreateSunlessScene()
    {
        const scene = new EveSpaceScene();
        scene.Initialize(Tr2RenderContext_GetMainThreadRenderContext());
        vec3.set(scene.sunDiffuseColor, 0, 0, 0);
        vec3.set(scene.sunDiffuseColorWithDynamicLights, 0, 0, 0);
        return scene;
    }

    /**
     * The bays, as data.
     *
     * @returns {{index: number, size: string, occupied: boolean, position: number[], camera: number[]|null}[]}
     *   `size` is "small", "medium", "capital" or "any".
     */
    GetBays()
    {
        return this._bays.map(bay => ({ index: bay.index, size: bay.size, occupied: !!bay.ship,
            position: Array.from(bay.position), camera: bay.camera ? Array.from(bay.camera) : null }));
    }

    /**
     * The ship in a bay.
     *
     * @param {number} [bay=this.active] The bay.
     * @returns {TnyShip|null} The ship, or null.
     */
    GetShip(bay = this.active)
    {
        return this._bays[bay]?.ship ?? null;
    }

    /**
     * Where the camera looks at a bay from, in world space: the bay's
     * `*_dock_camera_transition_points` locator, or the capital hangar's
     * `camera_locations`. For `Tny.Focus(ship, { from })`.
     *
     * @param {number} [bay=this.active] The bay.
     * @returns {number[]|null} The point, or null when the hangar has none.
     */
    GetCameraPoint(bay = this.active)
    {
        const camera = this._bays[bay]?.camera;
        return camera ? Array.from(camera) : null;
    }

    /**
     * Puts a ship in a bay. A ship already in that bay dissolves out
     * (`materialize` 0) while the new one comes in, and leaves the scene once
     * its dissolve has run.
     *
     * @param {TnyShip|string} ship A ship, or DNA to fetch one.
     * @param {object} [options]
     * @param {number} [options.bay] The bay; omitted, one chosen by the ship's size (ours, see SMALL_SHIP_RADIUS).
     * @param {"docked"|"dock"|"appear"} [options.entry="docked"] Already there, flying in, or fading in.
     *   A hangar without a docker has no fade; "appear" is "docked" there.
     * @returns {Promise<TnyShip>} The ship, now in this scene.
     */
    async SetShip(ship, { bay = undefined, entry = "docked" } = {})
    {
        if (!ENTRIES.includes(entry)) throw new RangeError(`TnyHangar entry must be one of ${ENTRIES.join(", ")}.`);
        if (bay !== undefined && !this._bays[bay]) throw new RangeError(`TnyHangar has no bay ${bay}.`);
        const wrapper = typeof ship === "string" ? await this.Fetch({ dna: ship }) : ship;
        if (!CjsSchema.cast(wrapper, TnyShip)) throw new TypeError("TnyHangar.SetShip requires a TnyShip or ship DNA.");
        this.AddObject(wrapper);

        const current = this._bays.find(record => record.ship === wrapper);
        if (current) this._Release(current, false);
        const target = this._bays[bay ?? this._ChooseBay(wrapper)];
        if (target.ship) this._Release(target, true);
        await this._Seat(target, wrapper, entry);
        this.active = target.index;
        return wrapper;
    }

    /**
     * Undocks a bay's ship: the docker flies it out (and, the hangar view
     * never leaving, round again: its undock_cancelled states); a hangar
     * without a docker plays its own undock (controller variable `Undock`).
     *
     * @param {number} [bay=this.active] The bay.
     * @returns {boolean} Whether a ship was there.
     */
    Undock(bay = this.active)
    {
        const record = this._bays[bay];
        if (!record?.ship) return false;
        if (this.kind === "origin") SetVariable(this.hangar.wrapped.controllers, "Undock", 1);
        else record.effect.SetControllerVariable("docked", 0);
        return true;
    }

    /** Removes the hangar's effects and timers; the ships and the hangar stay in the scene. */
    Destruct()
    {
        for (const timer of this._timers) clearTimeout(timer);
        this._timers.clear();
        for (const bay of this._bays) if (bay.ship) this._Release(bay, false);
    }

    /** Finds the bays from what the built hangar holds. */
    _FindBays()
    {
        const root = this.hangar.wrapped;
        const layouts = root.effectChildren.find(child => child.name === "layouts") ?? null;
        const containers = layouts ? layouts.objects : [];
        const bays = [];
        for (const [ size, placement ] of Object.entries(BAY_PLACEMENTS))
            for (const container of containers)
                if (container.name === placement) bays.push(this._Bay(size, container, container.objects[0]));

        if (bays.length)
        {
            this.kind = "layout";
            this._PairExits(bays, containers);
        }
        else
        {
            const placement = FindLocator(root.locatorSets, "ship_placement");
            this.kind = placement ? "capital" : "origin";
            const bay = { size: this.kind === "capital" ? "capital" : "any", dock: placement ? root : null,
                position: vec3.create(), rotation: quat.create(), exit: null, camera: null }; // alloc: kept by the bay
            if (placement) vec3.copy(bay.position, placement.position);
            const camera = FindLocator(root.locatorSets, "camera_locations");
            if (camera) bay.camera = vec3.clone(camera.position); // alloc: kept by the bay
            bays.push(this._Place(bay));
        }
        this._bays = bays.map((bay, index) => Object.assign(bay, { index, ship: null, effect: null, saved: null }));
    }

    /** A layout bay: its transform is its placed hull's; its camera point its own transition locator. */
    _Bay(size, container, hull)
    {
        // alloc: kept by the bay
        const bay = { size, dock: container, position: vec3.clone(hull.translation), rotation: quat.clone(hull.rotation),
            exit: null, camera: null };
        const camera = FindLocator(hull.ownedLocatorSets, `${size}_dock_camera_transition_points`);
        if (camera)
        {
            bay.camera = vec3.transformQuat(vec3.create(), camera.position, bay.rotation); // alloc: kept by the bay
            vec3.add(bay.camera, bay.camera, bay.position);
        }
        return this._Place(bay);
    }

    /** Moves a bay from hangar space into world space. */
    _Place(bay)
    {
        const world = this.hangar.wrapped.worldTransform;
        const { quat_0 } = TnyHangar.scratch;
        const rotation = mat4.getRotation(quat_0, world);
        vec3.transformMat4(bay.position, bay.position, world);
        quat.multiply(bay.rotation, rotation, bay.rotation);
        if (bay.camera) vec3.transformMat4(bay.camera, bay.camera, world);
        return bay;
    }

    /**
     * Gives each bay its exit point: the parent hulls' `small_dock_exit_points`
     * and `medium_dock_exit_points` sit beside the bay locators, one per bay,
     * paired here by distance (DERIVED; the sets do not share an order). The
     * docker's `docking_cs` `exit_point` takes the bay-local vector to it and
     * its length (TriValueBindings feed them to the undock yaw).
     */
    _PairExits(bays, containers)
    {
        for (const size of Object.keys(BAY_PLACEMENTS))
        {
            const exits = [];
            for (const hull of containers)
            {
                if (hull.name !== "Hull") continue;
                const set = (hull.ownedLocatorSets ?? []).find(each => each.name === `${size}_dock_exit_points`);
                if (!set) continue;
                for (const locator of set.locators)
                {
                    const point = vec3.transformQuat(vec3.create(), locator.position, hull.rotation); // alloc: one per exit, at load
                    vec3.add(point, point, hull.translation);
                    exits.push(vec3.transformMat4(point, point, this.hangar.wrapped.worldTransform));
                }
            }
            const free = exits.slice();
            for (const bay of bays.filter(each => each.size === size))
            {
                if (!free.length) break;
                let best = 0;
                for (let i = 1; i < free.length; i++)
                    if (vec3.distance(free[i], bay.position) < vec3.distance(free[best], bay.position)) best = i;
                const { vec3_0, quat_0 } = TnyHangar.scratch;
                vec3.subtract(vec3_0, free.splice(best, 1)[0], bay.position);
                vec3.transformQuat(vec3_0, vec3_0, quat.invert(quat_0, bay.rotation));
                bay.exit = [ vec3_0[0], vec3_0[1], vec3_0[2], vec3.length(vec3_0) ];
            }
        }
    }

    /** Ours: a free bay of the ship's size class, else any free bay, else the first of its size. */
    _ChooseBay(ship)
    {
        if (this._bays.length === 1) return 0;
        const radius = ship.GetBoundingSphere()?.radius ?? 0;
        const size = radius < TnyHangar.SMALL_SHIP_RADIUS ? "small" : "medium";
        const fits = this._bays.filter(bay => bay.size === size);
        const pick = fits.find(bay => !bay.ship) ?? this._bays.find(bay => !bay.ship) ?? fits[0] ?? this._bays[0];
        return pick.index;
    }

    /**
     * Takes over the ship's curves and starts the effect that animates it.
     * Layout and capital bays: the docker writes the ship's
     * `translationCurve.curves[1]` (bay-local) and `modelRotationCurve`; ours
     * is a Tr2CurveCombiner of the bay's position and that offset, which a
     * Tr2TranslationAdapter turns by the bay's rotation (its rotationOffset).
     * Other hangars: me_generic writes `modelTranslationCurve`.
     */
    async _Seat(bay, ship, entry)
    {
        const native = ship.wrapped;
        if (ship._ball) ship.SetBall(null);
        bay.saved = { translationCurve: native.translationCurve, rotationCurve: native.rotationCurve,
            modelRotationCurve: native.modelRotationCurve, modelTranslationCurve: native.modelTranslationCurve };
        bay.ship = ship;

        const library = CjsLibrary.instance;
        if (this.kind === "origin")
        {
            native.translationCurve = null;
            native.rotationCurve = null;
            native.modelTranslationCurve = new Tr2TranslationAdapter();
            const effect = bay.effect = await library.Fetch(TnyHangar.HANGAR_EFFECT);
            effect.SetParameter("ship", native);
            effect.SetParameter("Hangar", this.hangar.wrapped);
            effect.SetParameter("PostProcess", this.wrapped.postprocess);
            const hangarType = HangarType(effect, this.hangar.identity);
            if (hangarType !== null) effect.SetControllerVariable("HangarType", hangarType);
            effect.SetControllerVariable("skipNextEntryAnimation", entry === "dock" ? 0 : 1);
        }
        else
        {
            const base = new Tr2TranslationAdapter();
            vec3.copy(base.value, bay.position);
            const offset = new Tr2TranslationAdapter();
            quat.copy(offset.rotationOffset, bay.rotation);
            const translation = new Tr2CurveCombiner();
            translation.curves.Append(base);
            translation.curves.Append(offset);
            const rotation = new Tr2CurveConstant();
            quat.copy(rotation.value, bay.rotation);
            native.translationCurve = translation;
            native.rotationCurve = rotation;
            native.modelRotationCurve = new Tr2CurveConstant();
            quat.identity(native.modelRotationCurve.value);
            native.modelTranslationCurve = null;

            const path = TnyHangar.DEFAULTS[this.hangar.identity.hull]?.docker ?? TnyHangar.DOCKER;
            const effect = bay.effect = await library.Fetch(path);
            effect.SetParameter("docking_ship", native);
            effect.SetParameter("docking_dock", bay.dock);
            if (bay.exit)
            {
                const exit = effect.curveSets.find(set => set.name === "docking_cs")?.curves.find(curve => curve.name === "exit_point");
                if (exit) exit.value.set(bay.exit);
            }
            effect.SetControllerVariable("isCapital", bay.size === "capital" ? 1 : 0);
            effect.SetControllerVariable("docked", entry === "dock" ? 0 : 1);
            if (entry === "appear") effect.SetControllerVariable("skinChange", 1);
        }
        if (bay.ship !== ship) return;
        this.wrapped.objects.Append(bay.effect);
        bay.effect.StartControllers();
    }

    /**
     * Takes a ship out of its bay. Dissolving, the docker runs `materialize` 0
     * and the ship leaves the scene after the docker's
     * `dematerializationDuration`; otherwise it leaves the bay at once and
     * stays in the scene with its own curves back.
     */
    _Release(bay, dissolve)
    {
        const { ship, effect, saved } = bay;
        bay.ship = bay.effect = bay.saved = null;
        const finish = () =>
        {
            const objects = this.wrapped.objects;
            if (effect)
            {
                const index = objects.indexOf(effect);
                if (index !== -1) objects.Remove(index);
            }
            Object.assign(ship.wrapped, saved);
            if (dissolve) this.RemoveObject(ship);
        };
        const seconds = dissolve && effect ? GetVariable(effect.controllers, "dematerializationDuration") : null;
        if (seconds === null || this.kind === "origin") return finish();
        effect.SetControllerVariable("materialize", 0);
        const timer = setTimeout(() => { this._timers.delete(timer); finish(); }, seconds * 1000);
        this._timers.add(timer);
    }
}

/** The first locator of a named set, or null. */
function FindLocator(sets, name)
{
    return (sets ?? []).find(each => each.name === name)?.locators[0] ?? null;
}

/** A controller variable's value, or null when no controller has it. */
function GetVariable(controllers, name)
{
    for (const controller of controllers)
    {
        const variable = controller.variables?.find(each => each.name === name);
        if (variable) return variable.value;
    }
    return null;
}

/** Sets a variable on every controller that has it. */
function SetVariable(controllers, name, value)
{
    for (const controller of controllers) controller.SetVariable(name, value);
}

/**
 * me_generic's `HangarType` for a hangar, from the variable's own
 * `enumValues` ("Default = 0, AmarrBase = 1, ..., AirBase = 7, ..."): the
 * entry named after the hangar's faction, or its faction or race plus "Base"
 * (amarrbase → AmarrBase, air → AirBase, caldari → CaldariBase). Only the
 * light-rig loader tells the racial values apart. Null when none matches,
 * leaving the default.
 */
function HangarType(effect, identity)
{
    let enumValues = "";
    for (const controller of effect.controllers)
    {
        const variable = controller.variables?.find(each => each.name === "HangarType");
        if (variable) enumValues = variable.enumValues;
    }
    const entries = new Map(enumValues.split(",").map(entry => entry.split("=").map(part => part.trim()))
        .filter(([ name, value ]) => name && value !== undefined).map(([ name, value ]) => [ name.toLowerCase(), Number(value) ]));
    for (const candidate of [ identity.faction, identity.faction && `${identity.faction}base`, identity.race && `${identity.race}base` ])
        if (candidate && entries.has(candidate.toLowerCase())) return entries.get(candidate.toLowerCase());
    return null;
}
