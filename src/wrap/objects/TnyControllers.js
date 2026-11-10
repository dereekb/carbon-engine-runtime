import { CjsSchema } from "#schema";
import { Type } from "../../trinity/controllers/enums.js";
import { EveChildContainer } from "../../trinity/eve/child/EveChildContainer.js";

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

    /** @param {import("./TnySpaceObject.js").TnySpaceObject} owner The wrapper. */
    constructor(owner)
    {
        this.owner = owner;
    }

    /**
     * The Tr2Controllers the object's SetControllerVariable reaches and that
     * hold a controller list: its own, its overlays' (EveMeshOverlayEffect) and
     * its container effect children's (EveChildContainer). Other children
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
        return found;
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
            variables: controller.variables.map(variable => ({
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
     * The names of every variable the controllers declare, without repeats.
     *
     * @returns {string[]} Variable names.
     */
    GetVariableNames()
    {
        return [ ...new Set(this._Controllers().flatMap(controller => controller.variables.map(variable => variable.name))) ];
    }

    /**
     * A variable's value in the first controller that declares it.
     *
     * @param {string} name The variable.
     * @returns {number|null} Its value, or null when no controller declares it.
     */
    GetVariable(name)
    {
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
        if (!Number.isFinite(value)) throw new TypeError("A controller variable takes a number.");
        this.owner.wrapped.SetControllerVariable(name, value);
    }
}
