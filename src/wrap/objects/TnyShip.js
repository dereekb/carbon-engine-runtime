import { CjsSchema } from "#schema";
import { vec3 } from "#math/vec3";
import { EveShip2 } from "../../trinity/eve/spaceObject/EveShip2.js";
import { TnyMobile } from "./TnyMobile.js";
import { TnyMotion } from "./TnyMotion.js";

/** The decal effect SOF uses for a hull's kill counter (EveSOF DECAL_EFFECT_NAMES, USAGE_KILLCOUNTER). */
const KILL_COUNTER_EFFECT = /decalcounterv5\.fx$/i;

/**
 * The exclusive ship states: a controller variable belongs to one when its name
 * names the subject AND has a state flag's shape (`IsWarping`, `isDocked`,
 * `InSiegeMode`), so `WarpTopSpeed` never receives a 1. After Graphene's
 * ShipStates and skindr's ShipControls. `always` names the variable set even
 * when no controller declares it: the docker multi-effect drives a ship's
 * `IsWarping` and `isDocked` (res:/dx9/model/hangar/shared/docker/multieffect_docker_01a.black).
 */
const SHIP_STATES = [
    { name: "warp", test: /warp/i, always: "IsWarping" },
    { name: "dock", test: /dock/i, always: "isDocked" },
    { name: "siege", test: /siege/i },
    { name: "attack", test: /attack|aggress|combat/i }
];
const STATE_SHAPE = /^_?(?:[iI]s|[iI]n|[hH]as|[uU]se)[A-Z]|(?:^|_|[a-z])(?:Mode|On|Enabled|Active|Requested)$/;

/** The stance variable a tactical ship's controllers declare. */
const STANCE = /stance/i;

/** Speeds in metres per second that the parameters accept. */
const MAX_SPEED = 100000;

/** A ship (EveShip2). Ours, after ccpwgl's TnyShip. `TnyShip.fetch({ dna })` requires a ship. */
export class TnyShip extends TnyMobile
{
    static className = "TnyShip";

    static wrappedClass = EveShip2;

    static wrappedName = "EveShip2";

    static parameters = [
        ...TnyMobile.parameters,
        // Moves the ship along its heading (TnyMotion), so its world velocity, EveShip2.speed
        // and everything reading ShipSpeed() follow. Only on a ship with no authored motion.
        { name: "speed", type: "number", min: 0, max: MAX_SPEED,
            available: o => !o.wrapped.translationCurve || CjsSchema.cast(o.wrapped.translationCurve, TnyMotion) !== null,
            read: o => o._motion ? vec3.length(o._motion.velocity) : 0,
            write: (o, v) => o._SetSpeed(v) },
        // EveShip2.maxSpeed, and the booster set's maxVel it scales trails by (EveBoosterSet2.cpp:109).
        { name: "maxSpeed", type: "number", min: 1, max: MAX_SPEED,
            read: o => o.wrapped.maxSpeed,
            write: (o, v) => { o._Bind(o.wrapped, "maxSpeed").SetValue(v); if (o.wrapped.boosters) o._Bind(o.wrapped.boosters, "maxVel").SetValue(v); } },
        // Kill marks, on hulls with a kill-counter decal.
        { name: "displayKillCounterValue", type: "integer", min: 0, max: 999,
            available: o => o.wrapped.decals.some(decal => KILL_COUNTER_EFFECT.test(decal.decalEffect?.effectFilePath ?? "")),
            read: o => o.wrapped.displayKillCounterValue,
            write: (o, v) => o._Bind(o.wrapped, "displayKillCounterValue").SetValue(v) },
        // Booster set members (EveBoosterSet2), on ships with boosters; Graphene's Boosters group.
        { name: "boosters.alwaysOn", type: "boolean", available: o => !!o.wrapped.boosters,
            read: o => o.wrapped.boosters.alwaysOn,
            // alwaysOn skips Carbon's 200 m trail minimum (EveBoosterSet2.cpp:383-387); off physics,
            // staticTrailLength sets the trail (Graphene TrinityBoosterParameters).
            write: (o, v) => { o._Bind(o.wrapped.boosters, "alwaysOn").SetValue(v); o._Bind(o.wrapped.boosters, "physicsUpdate").SetValue(!v); } },
        ...[ [ "alwaysOnIntensity", 10 ], [ "warpIntensity", 10 ] ].map(([ member, max ]) => ({
            name: `boosters.${member}`, type: "number", min: 0, max, available: o => !!o.wrapped.boosters,
            read: o => o.wrapped.boosters[member], write: (o, v) => o._Bind(o.wrapped.boosters, member).SetValue(v) })),
        { name: "boosters.staticTrailLength", type: "number", min: 0, max: 10000, available: o => !!o.wrapped.boosters?.trails,
            read: o => o.wrapped.boosters.staticTrailLength, write: (o, v) => o._Bind(o.wrapped.boosters, "staticTrailLength").SetValue(v) }
    ];

    /** The motion `speed` installed as the ship's translation curve, or null. */
    _motion = null;

    /** The state SetState last set. */
    _state = "standard";

    /**
     * The states this ship offers: standard, warp and dock always (a state
     * nothing drives is still valid: docked doing nothing is its effect), plus
     * siege and attack where its controllers declare them (operator, 2026-11-10).
     *
     * @returns {string[]} State names.
     */
    GetStates()
    {
        const names = this.controllers.GetVariableNames();
        return [ "standard", ...SHIP_STATES.filter(state => state.always || names.some(name => state.test.test(name) && STATE_SHAPE.test(name))).map(state => state.name) ];
    }

    /** @returns {string} The state SetState last set. */
    GetState()
    {
        return this._state;
    }

    /**
     * Enters one state: its variables go to 1 and every other state's to 0,
     * through the ship's SetControllerVariable. "standard" sets them all to 0.
     *
     * @param {string} name A name from GetStates.
     */
    SetState(name)
    {
        if (!this.GetStates().includes(name)) throw new RangeError(`${this.constructor.className} has no state ${name}.`);
        const names = this.controllers.GetVariableNames();
        for (const state of SHIP_STATES)
        {
            const variables = new Set(names.filter(variable => state.test.test(variable) && STATE_SHAPE.test(variable)));
            if (state.always) variables.add(state.always);
            for (const variable of variables) this.wrapped.SetControllerVariable(variable, state.name === name ? 1 : 0);
        }
        this._state = name;
    }

    /**
     * The stances a tactical ship's controllers declare, from the stance
     * variable's own enumValues; empty when it has none.
     *
     * @returns {{variable: string, choices: {name: string, value: number}[]}|null} The stance variable, or null.
     */
    GetStances()
    {
        for (const controller of this.controllers.GetControllers())
        {
            const variable = controller.variables.find(entry => STANCE.test(entry.name));
            if (variable) return { variable: variable.name, choices: variable.choices ?? [] };
        }
        return null;
    }

    /**
     * Sets the stance, independent of the state.
     *
     * @param {number} value A choice's value from GetStances.
     */
    SetStance(value)
    {
        const stances = this.GetStances();
        if (!stances) throw new RangeError(`${this.constructor.className} has no stance.`);
        this.controllers.SetVariable(stances.variable, value);
    }

    /**
     * Sets the speed along the ship's heading, installing the motion on first use.
     * A ship with no maxSpeed gets its booster set's maxVel (EveBoosterSet2's 250 when none),
     * so ShipSpeed()/ShipMaxSpeed() has a scale.
     */
    _SetSpeed(speed)
    {
        const ship = this.wrapped;
        if (!this._motion)
        {
            this._motion = new TnyMotion();
            ship.translationCurve = this._motion;
            if (!(ship.maxSpeed > 0)) this.SetParameter("maxSpeed", ship.boosters ? ship.boosters.maxVel : 250);
        }
        // The heading: the ship's local +Z in world space.
        const heading = vec3.transformQuat(vec3.create(), [ 0, 0, 1 ], ship.worldRotation);
        this._motion.SetVelocity(vec3.scale(heading, heading, speed));
    }
}
