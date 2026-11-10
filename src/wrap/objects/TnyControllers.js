import { CjsSchema } from "#schema";
import { Type } from "../../trinity/controllers/enums.js";
import { EveChildContainer } from "../../trinity/eve/child/EveChildContainer.js";
import { Tr2Controller } from "../../trinity/controllers/Tr2Controller.js";
import { Tr2ControllerReference } from "../../trinity/controllers/Tr2ControllerReference.js";
import { Tr2ActionSetValue } from "../../trinity/controllers/action/Tr2ActionSetValue.js";

/** Variable types by their Tr2ControllerFloatVariable::Type value. */
const TYPE_NAMES = { [Type.FLOAT]: "number", [Type.INTEGER]: "integer", [Type.BOOLEAN]: "boolean", [Type.ENUM]: "enum" };

/**
 * Parses a variable's enumValues ("xs = 1, s = 2") into choices.
 *
 * @param {string} text The authored list.
 * @returns {{name: string, value: number}[]} The choices, in order.
 */
function ParseEnumValues(text)
{
    return String(text).split(",").map(entry => entry.split("="))
        .filter(parts => parts.length === 2 && parts[0].trim())
        .map(([ name, value ]) => ({ name: name.trim(), value: Number(value) }));
}

/**
 * What a space object's controllers expose, and nothing else: their variables
 * and their state machines' current states. Ours. Writes go through the
 * object's own SetControllerVariable, which in Carbon reaches the object's
 * controllers, effect children and overlays.
 */
export class TnyControllers
{
    static className = "TnyControllers";

    /** The TnySpaceObject whose controllers these are. */
    owner = null;

    /** Gives the multi-effects listed beside the owner's own controllers; none by default. */
    effects = () => [];

    /**
     * @param {import("./TnySpaceObject.js").TnySpaceObject} owner The wrapper.
     * @param {Function} [effects] Gives EveMultiEffects driving the owner (a hangar's docker),
     *   whose controllers are listed and set too.
     */
    constructor(owner, effects = null)
    {
        this.owner = owner;
        if (effects) this.effects = effects;
    }

    /**
     * The Tr2Controllers the object's SetControllerVariable reaches and that
     * hold a controller list: its own, its overlays' (EveMeshOverlayEffect),
     * its container effect children's (EveChildContainer) and the given
     * effects', a Tr2ControllerReference standing for the controller it loaded. Other children
     * answer the variable through their own SetControllerVariable without
     * listing controllers, so they are not shown.
     *
     * @returns {object[]} The native controllers.
     */
    _Controllers()
    {
        const object = this.owner.wrapped;
        const found = [ ...object.controllers ];
        for (const overlay of object.overlayEffects) found.push(...overlay.controllers);
        for (const child of object.effectChildren)
        {
            const container = CjsSchema.cast(child, EveChildContainer);
            if (container) found.push(...container.controllers);
        }
        for (const effect of this.effects()) found.push(...effect.controllers);
        // A Tr2ControllerReference shows the controller it loaded, once loaded.
        // A controller whose name starts with "_" is private to the content.
        return found.flatMap(controller =>
        {
            const reference = CjsSchema.cast(controller, Tr2ControllerReference);
            const target = CjsSchema.cast(reference ? reference.controller : controller, Tr2Controller);
            return target && IsPublic(target.name) ? [ target ] : [];
        });
    }

    /**
     * The controllers, as their exposure describes them.
     *
     * @returns {{name: string, variables: object[], stateMachines: {name: string, state: string|null}[]}[]} One per controller.
     */
    GetControllers()
    {
        return this._Controllers().map(controller => ({
            name: controller.name,
            variables: controller.variables.filter(variable => IsPublic(variable.name)).map(variable => ({
                name: variable.name,
                type: TYPE_NAMES[variable.variableType] ?? "number",
                value: variable.GetValue(),
                defaultValue: variable.defaultValue,
                ...(variable.variableType === Type.ENUM ? { choices: ParseEnumValues(variable.enumValues) } : {})
            })),
            stateMachines: controller.stateMachines.map(machine => ({
                name: machine.name,
                state: machine.GetCurrentState()?.name ?? null
            }))
        }));
    }

    /**
     * The "do something" actions the content offers: each controller event
     * (Tr2ControllerEventHandler, run by HandleControllerEvent), and each
     * trigger variable, a public variable defaulting to 0 that its own
     * controller's states only ever set back to 0 once they have run (the
     * hangar's Undock, the docker's skinChange). The trigger rule is DERIVED
     * from the content's shape. Trigger runs one; it can run again.
     *
     * @returns {{name: string, kind: "event"|"trigger", controller: string}[]} The actions.
     */
    GetActions()
    {
        const actions = new Map();
        for (const controller of this._Controllers())
        {
            for (const handler of controller.eventHandlers)
                if (IsPublic(handler.name) && !actions.has(handler.name)) actions.set(handler.name, { name: handler.name, kind: "event", controller: controller.name });
            const resets = new Map();
            for (const machine of controller.stateMachines)
                for (const state of machine.states)
                    for (const action of state.actions)
                    {
                        const set = CjsSchema.cast(action, Tr2ActionSetValue);
                        if (set && set.attribute === "value" && set.path) (resets.get(set.path) ?? resets.set(set.path, []).get(set.path)).push(set.value);
                    }
            for (const variable of controller.variables)
            {
                const values = resets.get(variable.name);
                if (!IsPublic(variable.name) || variable.defaultValue !== 0 || !values || actions.has(variable.name)) continue;
                if (values.every(value => Number(value) === 0)) actions.set(variable.name, { name: variable.name, kind: "trigger", controller: controller.name });
            }
        }
        return [ ...actions.values() ];
    }

    /**
     * Runs an action from GetActions: an event goes to every controller
     * (HandleControllerEvent), a trigger variable is set to 1 and the content
     * sets it back.
     *
     * @param {string} name The action.
     * @returns {boolean} Whether it was an action.
     */
    Trigger(name)
    {
        const action = this.GetActions().find(each => each.name === name);
        if (!action) return false;
        if (action.kind === "trigger")
        {
            this.SetVariable(name, 1);
            return true;
        }
        this.owner.wrapped.HandleControllerEvent(name);
        for (const effect of this.effects()) effect.HandleControllerEvent(name);
        return true;
    }

    /**
     * The names of every variable the controllers declare, without repeats.
     *
     * @returns {string[]} Variable names.
     */
    GetVariableNames()
    {
        return [ ...new Set(this._Controllers().flatMap(controller => controller.variables.map(variable => variable.name).filter(IsPublic))) ];
    }

    /**
     * A variable's value in the first controller that declares it.
     *
     * @param {string} name The variable.
     * @returns {number|null} Its value, or null when no controller declares it or it is private.
     */
    GetVariable(name)
    {
        if (!IsPublic(name)) return null;
        for (const controller of this._Controllers())
        {
            const variable = controller.GetVariableByName(name);
            if (variable) return variable.GetValue();
        }
        return null;
    }

    /**
     * Sets a variable the Carbon way, on every controller that has it.
     *
     * @param {string} name The variable.
     * @param {number} value Its new value.
     */
    SetVariable(name, value)
    {
        if (!IsPublic(name)) throw new RangeError(`${name} is private to the content.`);
        if (!Number.isFinite(value)) throw new TypeError("A controller variable takes a number.");
        this.owner.wrapped.SetControllerVariable(name, value);
        for (const effect of this.effects()) effect.SetControllerVariable(name, value);
    }
}

/** Whether a controller or variable name is public: content marks private ones with a leading "_". */
function IsPublic(name)
{
    return !String(name).startsWith("_");
}
