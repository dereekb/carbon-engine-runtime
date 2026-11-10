import { CjsSchema, meta, type } from "#schema";
import { vec3 } from "#math/vec3";
import { CjsBlueGraph } from "../../blue/formats/graph/CjsBlueGraph.js";
import { Type } from "../../trinity/controllers/enums.js";
import { Tr2ActionPlayMeshAnimation } from "../../trinity/controllers/action/Tr2ActionPlayMeshAnimation.js";
import { EveShip2 } from "../../trinity/eve/spaceObject/EveShip2.js";
import { TnyMobile } from "./TnyMobile.js";
import { TnyShipIdentity } from "./TnyShipIdentity.js";

/** The decal effect SOF uses for a hull's kill counter (EveSOF DECAL_EFFECT_NAMES, USAGE_KILLCOUNTER). */
const KILL_COUNTER_EFFECT = /decalcounterv5\.fx$/i;

/**
 * The exclusive ship states: a controller variable belongs to one when its name
 * names the subject AND has a state flag's shape (`IsWarping`, `isDocked`,
 * `InSiegeMode`), so `WarpTopSpeed` never receives a 1. After Graphene's
 * ShipStates and skindr's ShipControls. `always` names the variable set even
 * when no controller declares it: the docker multi-effect drives a ship's
 * `IsWarping` and `isDocked` (res:/dx9/model/hangar/shared/docker/multieffect_docker_01a.black).
 * Warp and dock are offered on every ship (operator, 2026-11-10).
 */
const SHIP_STATES = [
    { name: "warp", test: /warp/i, always: "IsWarping" },
    { name: "dock", test: /dock/i, always: "isDocked" },
    { name: "siege", test: /siege/i },
    { name: "attack", test: /attack|aggress|combat/i }
];
const STATE_SHAPE = /^_?(?:[iI]s|[iI]n|[hH]as|[uU]se)[A-Z]|(?:^|_|[a-z])(?:Mode|On|Enabled|Active|Requested)$/;

/** Members a UI writes and the wrapper hears. */
const VALUE = meta.READWRITE | meta.NOTIFY;

/** The booster set members a ship offers, EveBoosterSet2's own names (Graphene's Boosters group). */
const BOOSTER_MEMBERS = [ "alwaysOn", "alwaysOnIntensity", "warpIntensity", "staticTrailLength" ];

/**
 * A ship (EveShip2): adds motion, kill marks, boosters, states and stance.
 * Ours, after ccpwgl's TnyShip.
 */
@meta.define({ className: "TnyShip" })
@meta.exposureChainTo(TnyMobile)
export class TnyShip extends TnyMobile
{
    static wrappedClass = EveShip2;

    static identityClass = TnyShipIdentity;

    static ranges = { ...TnyMobile.ranges, speed: [ 0, 100000 ], maxSpeed: [ 1, 100000 ], displayKillCounterValue: [ 0, 999 ],
        alwaysOnIntensity: [ 0, 10 ], warpIntensity: [ 0, 10 ], staticTrailLength: [ 0, 10000 ] };

    /**
     * Metres per second along the ship's heading, driving its Destiny ball
     * (SetBall), so its world velocity, EveShip2.speed and ShipSpeed() follow.
     * Null without a ball.
     */
    @meta.mapAttribute(VALUE)
    @type.float32
    speed = null;

    /** EveShip2.maxSpeed, and the booster set's maxVel it scales trails by (EveBoosterSet2.cpp:109). */
    @meta.mapAttribute(VALUE)
    @type.float32
    maxSpeed = null;

    /** Kill marks (EveShip2.displayKillCounterValue), on hulls with a kill-counter decal. */
    @meta.mapAttribute(VALUE)
    @type.uint32
    displayKillCounterValue = null;

    /** EveBoosterSet2.alwaysOn; switching it also switches physicsUpdate (Graphene). */
    @meta.mapAttribute(VALUE)
    @type.boolean
    alwaysOn = null;

    /** EveBoosterSet2.alwaysOnIntensity. */
    @meta.mapAttribute(VALUE)
    @type.float32
    alwaysOnIntensity = null;

    /** EveBoosterSet2.warpIntensity. */
    @meta.mapAttribute(VALUE)
    @type.float32
    warpIntensity = null;

    /** EveBoosterSet2.staticTrailLength, on sets with trails. */
    @meta.mapAttribute(VALUE)
    @type.float32
    staticTrailLength = null;

    /** The ship state: "standard", "warp", "dock", and "siege"/"attack" where its controllers have them. */
    @meta.mapAttribute(VALUE)
    @type.string
    state = null;

    /** The stance's value from its enum choices, on ships with a stance. */
    @meta.mapAttribute(VALUE)
    @type.int32
    stance = null;

    /**
     * The ship's Destiny client ball (server/destiny CjsDestinyClientBall), or
     * null. The application owns the park; the runtime never imports Destiny.
     */
    _ball = null;

    /** The states found: each state's controller variables. */
    _states = new Map();

    /** The stance: its variable name and choices, or null. */
    _stance = null;

    /** Finds the ship's own facts after the space object's. */
    _Discover(dna)
    {
        super._Discover(dna);
        const ship = this.wrapped;
        const take = (member, value) => { this._supported.add(member); this[member] = value; };

        if (this._ball) take("speed", Math.hypot(this._ball.vx, this._ball.vy, this._ball.vz));
        take("maxSpeed", ship.maxSpeed);
        if (ship.decals.some(decal => KILL_COUNTER_EFFECT.test(decal.decalEffect?.effectFilePath ?? "")))
            take("displayKillCounterValue", ship.displayKillCounterValue);
        if (ship.boosters)
        {
            for (const member of BOOSTER_MEMBERS)
                if (member !== "staticTrailLength" || ship.boosters.trails) take(member, ship.boosters[member]);
        }

        this._states = this._FindStates();
        take("state", "standard");
        this._stance = this._FindStance();
        if (this._stance) take("stance", this.controllers.GetVariable(this._stance.variable));
    }

    /** Each offered state's controller variables (warp and dock always). */
    _FindStates()
    {
        const names = this.controllers.GetVariableNames();
        const states = new Map([ [ "standard", [] ] ]);
        for (const state of SHIP_STATES)
        {
            const variables = names.filter(name => state.test.test(name) && STATE_SHAPE.test(name));
            if (!variables.length && !state.always) continue;
            if (state.always && !variables.includes(state.always)) variables.push(state.always);
            states.set(state.name, variables);
        }
        return states;
    }

    /**
     * The stance, found by what it is rather than by name (the Anhinga's
     * variable is named differently): an enum controller variable that a state
     * machine's transitions test and whose machine plays mesh animations, as
     * res:/dx9/model/controller/shipstance.black's ShipStance does.
     */
    _FindStance()
    {
        for (const controller of this.controllers._Controllers())
        {
            for (const variable of controller.variables)
            {
                if (variable.variableType !== Type.ENUM) continue;
                const test = new RegExp(`\\b${variable.name}\\b`);
                const drives = controller.stateMachines.some(machine =>
                    machine.states.some(state => state.transitions.some(transition => test.test(transition.condition)))
                    && machine.states.some(state => state.actions.some(action => CjsSchema.cast(action, Tr2ActionPlayMeshAnimation))));
                if (drives) return { variable: variable.name, choices: this.controllers.GetControllers()
                    .flatMap(entry => entry.variables).find(entry => entry.name === variable.name).choices };
            }
        }
        return null;
    }

    /** Pushes the ship's own members, else the space object's. */
    _Push(name)
    {
        const ship = this.wrapped;
        switch (name)
        {
            case "speed": this._SetSpeed(this.speed); return;
            case "maxSpeed":
                this._Bind(ship, "maxSpeed").SetValue(this.maxSpeed);
                if (ship.boosters) this._Bind(ship.boosters, "maxVel").SetValue(this.maxSpeed);
                if (this._ball) this._ball.mPark.SetMaxSpeed(this._ball.mId, this.maxSpeed);
                return;
            case "displayKillCounterValue": this._Bind(ship, name).SetValue(Math.round(this[name])); return;
            case "alwaysOn":
                // alwaysOn skips Carbon's 200 m trail minimum (EveBoosterSet2.cpp:383-387); off physics,
                // staticTrailLength sets the trail (Graphene TrinityBoosterParameters).
                this._Bind(ship.boosters, "alwaysOn").SetValue(this.alwaysOn);
                this._Bind(ship.boosters, "physicsUpdate").SetValue(!this.alwaysOn);
                return;
            case "alwaysOnIntensity": case "warpIntensity": case "staticTrailLength":
                this._Bind(ship.boosters, name).SetValue(this[name]);
                return;
            case "state": this._SetState(this.state); return;
            case "stance": this.controllers.SetVariable(this._stance.variable, this.stance); return;
            default: super._Push(name);
        }
    }

    /** Enters one state: its variables to 1, every other state's to 0; an unknown one is refused. */
    _SetState(name)
    {
        if (!this._states.has(name))
        {
            this.state = "standard";
            return;
        }
        for (const [ state, variables ] of this._states)
            for (const variable of variables) this.wrapped.SetControllerVariable(variable, state === name ? 1 : 0);
    }

    /**
     * Attaches the ship's Destiny client ball, or detaches it with null. The
     * ball becomes the ship's translation and rotation curve, as Carbon's
     * client binds a ship to its ball, so the ship moves and turns on the
     * scene clock through the ball's own *_Ticks methods. `speed` is supported
     * only while a ball is attached, so the type info changes.
     *
     * @param {object|null} ball A CjsDestinyClientBall in a park the application pumps, or null.
     */
    SetBall(ball)
    {
        const ship = this.wrapped;
        this._ball = ball;
        ship.translationCurve = ball;
        ship.rotationCurve = ball;
        if (ball)
        {
            this._supported.add("speed");
            this.speed = Math.hypot(ball.vx, ball.vy, ball.vz);
            if (!(ship.maxSpeed > 0)) this.SetValues({ maxSpeed: ball.maxVelocity > 0 ? ball.maxVelocity : 250 });
            else ball.mPark.SetMaxSpeed(ball.mId, ship.maxSpeed);
        }
        else
        {
            this._supported.delete("speed");
            this.speed = null;
        }
        if (this._onTypeInfoModified) this._onTypeInfoModified();
    }

    /**
     * Drives the ball: heads along the ship's heading at a throttle of
     * speed / maxSpeed (Destiny's GotoDirection and SetSpeedFraction, which
     * clamps to [0, 1]).
     */
    _SetSpeed(speed)
    {
        const ball = this._ball, park = ball.mPark;
        if (speed > 0)
        {
            // The heading: the ship's local +Z in world space.
            const heading = vec3.transformQuat(vec3.create(), [ 0, 0, 1 ], this.wrapped.worldRotation);
            park.GotoDirection(ball.mId, heading[0], heading[1], heading[2]);
        }
        park.SetSpeedFraction(ball.mId, this.maxSpeed > 0 ? speed / this.maxSpeed : 0);
    }

    /** The state and stance choices. */
    _Choices(name)
    {
        if (name === "state") return [ ...this._states.keys() ].map(state => [ state, state ]);
        if (name === "stance" && this._stance) return this._stance.choices.map(choice => [ choice.value, choice.name ]);
        return super._Choices(name);
    }

    /** Adds the capabilities a ship may have. */
    _Interfaces()
    {
        const names = super._Interfaces();
        if (this.stance !== null) names.push("stance");
        if (this.alwaysOn !== null) names.push("boosters");
        if (this.displayKillCounterValue !== null) names.push("killmarks");
        return names;
    }
}

CjsBlueGraph.define(TnyShip, "TnyShip");
