import { isPublicName, parseEnumValues } from "#utils/text";
import { Tr2ControllerFloatVariable } from "../../trinity/controllers/expression/Tr2ControllerFloatVariable.js";
import { Tr2Controller } from "../../trinity/controllers/Tr2Controller.js";

/**
 * What a space object's controllers expose, and nothing else: their variables
 * and their state machines' current states. Ours. Writes go through the
 * object's own SetControllerVariable, which in Carbon reaches the object's
 * controllers, effect children and overlays.
 * @cjs
 */
export class TnyControllers
{

    /**
     * The TnySpaceObject whose controllers these are.
     * @type {TnySpaceObject|null}
     * @cjs
     */
    owner = null;

    /**
     * Gives the multi-effects listed beside the owner's own controllers; none by default.
     * @type {Function}
     * @cjs
     */
    effects = () => [];

    /**
     * @param {import("./TnySpaceObject.js").TnySpaceObject} owner The wrapper.
     * @param {Function} [effects] Gives EveMultiEffects driving the owner (a hangar's docker),
     *   whose controllers are listed and set too.
     * @cjs
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
     * @cjs
     */
    _Controllers()
    {
        return this._Entries().filter(entry => entry.controller).map(entry => entry.controller);
    }

    /**
     * Each controller with where it sits in the immediate space-object scope:
     * its owner (the object, an overlay, a container child or a driving
     * effect, by name), its index in that owner's list, and for a
     * Tr2ControllerReference not loaded yet its path and no controller.
     * A controller whose name starts with "_" is private to the content.
     *
     * @returns {{controller: object|null, owner: string, index: number, path: string|null, reference: object|null}[]} The entries.
     * @cjs
     */
    _Entries()
    {
        return Tr2Controller.getEntries(this.owner.wrapped, this.effects());
    }

    /**
     * Starts every controller (Tr2Controller.Start), as Graphene's Start all.
     * @cjs
     */
    Start()
    {
        for (const entry of this._Entries()) (entry.reference ?? entry.controller).Start();
    }

    /**
     * Stops every controller.
     * @cjs
     */
    Stop()
    {
        for (const entry of this._Entries()) (entry.reference ?? entry.controller).Stop();
    }

    /**
     * Stops and starts every controller again.
     * @cjs
     */
    Restart()
    {
        this.Stop();
        this.Start();
    }

    /**
     * The controllers, as their exposure describes them.
     *
     * @returns {{name: string, owner: string, index: number, loading: string|null, variables: object[], stateMachines: {name: string, state: string|null}[]}[]}
     *   One per controller: `owner` names where it sits, `index` its place there; a reference still
     *   loading has `loading` (its path) and no variables.
     * @cjs
     */
    GetControllers()
    {
        return this._Entries().map(({ controller, owner, index, path }) =>
        {
            if (!controller) return { name: "", owner, index, loading: path, variables: [], stateMachines: [] };
            return {
                name: controller.name,
                owner,
                index,
                loading: null,
                variables: controller.variables.filter(variable => isPublicName(variable.name)).map(variable =>
                {
                    // Authored choices make a select whatever the type, as Graphene's Parameters do.
                    const choices = parseEnumValues(variable.enumValues);
                    return { name: variable.name, type: Tr2ControllerFloatVariable.getTypeName(variable.variableType), value: variable.GetValue(),
                        defaultValue: variable.defaultValue, ...(choices.length ? { choices } : {}) };
                }),
                stateMachines: controller.stateMachines.filter(machine => isPublicName(machine.name)).map(machine => ({
                    name: machine.name,
                    state: machine.GetCurrentState()?.name ?? null
                }))
            };
        });
    }

    /**
     * The "do something" actions the content offers: each controller event
     * (Tr2ControllerEventHandler, run by HandleControllerEvent), and each
     * trigger variable, a public variable defaulting to 0 that its own
     * controller's states only ever set back to 0 once they have run (the
     * hangar's Undock, the docker's skinChange). The trigger rule is DERIVED
     * from the content's shape. Trigger runs one; it can run again.
     *
     * @returns {{name: string, kind: "event"|"trigger", controller: string, running: boolean}[]} The actions;
     *   a trigger is running until the content has set it back to 0 (an event has no running state).
     * @cjs
     */
    GetActions()
    {
        return Tr2Controller.getActions(this._Controllers());
    }

    /**
     * Runs an action from GetActions: an event goes to every controller
     * (HandleControllerEvent), a trigger variable is set to 1 and the content
     * sets it back.
     *
     * @param {string} name The action.
     * @returns {boolean} Whether it was an action.
     * @cjs
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
     * @cjs
     */
    GetVariableNames()
    {
        return [ ...new Set(this._Controllers().flatMap(controller => controller.variables.map(variable => variable.name).filter(isPublicName))) ];
    }

    /**
     * A variable's value in the first controller that declares it.
     *
     * @param {string} name The variable.
     * @returns {number|null} Its value, or null when no controller declares it or it is private.
     * @cjs
     */
    GetVariable(name)
    {
        if (!isPublicName(name)) return null;
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
     * @cjs
     */
    SetVariable(name, value)
    {
        if (!isPublicName(name)) throw new RangeError(`${name} is private to the content.`);
        if (!Number.isFinite(value)) throw new TypeError("A controller variable takes a number.");
        this.owner.wrapped.SetControllerVariable(name, value);
        for (const effect of this.effects()) effect.SetControllerVariable(name, value);
    }

    /**
     * Stable identity for diagnostics and registration.
     * @type {string}
     * @cjs
     */
    static className = "TnyControllers";

}
