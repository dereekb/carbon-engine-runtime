import { CjsSchema } from "#schema";
import { vec3 } from "#math/vec3";
import { EveShip2 } from "../../trinity/eve/spaceObject/EveShip2.js";
import { TnyMobile } from "./TnyMobile.js";
import { TnyMotion } from "./TnyMotion.js";

/** The decal effect SOF uses for a hull's kill counter (EveSOF DECAL_EFFECT_NAMES, USAGE_KILLCOUNTER). */
const KILL_COUNTER_EFFECT = /decalcounterv5\.fx$/i;

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
