import assert from "node:assert/strict";
import test from "node:test";
import { TnyControllers } from "../../npm/dist/wrap/objects/TnyControllers.js";
import { Tr2Controller } from "../../npm/dist/trinity/controllers/Tr2Controller.js";
import { Tr2ControllerReference } from "../../npm/dist/trinity/controllers/Tr2ControllerReference.js";
import { Tr2ControllerEventHandler } from "../../npm/dist/trinity/controllers/Tr2ControllerEventHandler.js";
import { Tr2ControllerFloatVariable } from "../../npm/dist/trinity/controllers/expression/Tr2ControllerFloatVariable.js";
import { Tr2StateMachine } from "../../npm/dist/trinity/controllers/state/Tr2StateMachine.js";
import { Tr2StateMachineState } from "../../npm/dist/trinity/controllers/state/Tr2StateMachineState.js";
import { Tr2ActionSetValue } from "../../npm/dist/trinity/controllers/action/Tr2ActionSetValue.js";
import { EveChildContainer } from "../../npm/dist/trinity/eve/child/EveChildContainer.js";
import { isPublicName } from "../../npm/dist/global/utils/text.js";

test("controller inspection preserves owner order, indexes, duplicates and pending references", () =>
{
    const visible = new Tr2Controller(), hidden = new Tr2Controller();
    visible.name = "Visible";
    hidden.name = "_Hidden";
    const loaded = new Tr2ControllerReference(), pending = new Tr2ControllerReference();
    loaded.controller = visible;
    pending.path = "res:/pending.red";
    const container = new EveChildContainer();
    container.name = "Container";
    container.controllers.Append(visible);
    const object = {
        name: "Root", controllers: [ hidden, loaded, pending ],
        overlayEffects: [ { name: "Overlay", controllers: [ visible ] } ],
        effectChildren: [ { controllers: [ visible ] }, container ]
    };
    const effects = [ { name: "Driver", controllers: [ visible ] } ];
    const entries = Tr2Controller.getEntries(object, effects);
    assert.deepEqual(entries.map(({ owner, index, controller, path }) => [ owner, index, controller?.name ?? null, path ]), [
        [ "Root", 1, "Visible", null ],
        [ "Root", 2, null, "res:/pending.red" ],
        [ "Root / Overlay", 0, "Visible", null ],
        [ "Root / Container", 0, "Visible", null ],
        [ "Driver", 0, "Visible", null ]
    ]);
    assert.equal(entries[0].reference, loaded);
    assert.equal(entries[1].reference, pending);
    const wrapper = new TnyControllers({ wrapped: object }, () => effects);
    assert.equal(wrapper.GetControllers()[1].loading, pending.path);
    pending.controller = visible;
    assert.equal(wrapper.GetControllers()[1].loading, null, "resolution is observed on the next read");
});

test("action inspection preserves first-name precedence and the zero-reset heuristic", () =>
{
    const first = new Tr2Controller(), second = new Tr2Controller();
    first.name = "First";
    second.name = "Second";
    const machine = new Tr2StateMachine(), state = new Tr2StateMachineState();
    machine.name = "_Internal";
    machine.states.Append(state);
    first.stateMachines.Append(machine);
    for (const [ name, resets, defaultValue ] of [ [ "Go", [ "0", 0 ], 0 ], [ "Mixed", [ 0, 1 ], 0 ], [ "Default", [ 0 ], 1 ], [ "_Private", [ 0 ], 0 ] ])
    {
        const variable = new Tr2ControllerFloatVariable();
        Object.assign(variable, { name, defaultValue, value: 1 });
        first.variables.Append(variable);
        for (const value of resets)
        {
            const action = new Tr2ActionSetValue();
            Object.assign(action, { path: name, attribute: "value", value });
            state.actions.Append(action);
        }
    }
    for (const name of [ "Go", "Event", "_Secret" ])
    {
        const handler = new Tr2ControllerEventHandler();
        handler.name = name;
        second.eventHandlers.Append(handler);
    }
    assert.deepEqual(Tr2Controller.getActions([ first, second ]), [
        { name: "Go", kind: "trigger", controller: "First", running: true },
        { name: "Event", kind: "event", controller: "Second", running: false }
    ]);
    assert.equal(Tr2Controller.getActions([ second, first ])[0].kind, "event");
});

test("controller variable labels and private-name policy retain existing values", () =>
{
    assert.deepEqual([ 0, 1, 2, 3, 99 ].map(Tr2ControllerFloatVariable.getTypeName), [ "number", "integer", "boolean", "enum", "number" ]);
    assert.equal(isPublicName("_private"), false);
    assert.equal(isPublicName(""), true);
    assert.equal(isPublicName(null), true);
    const controller = new Tr2Controller(), variable = new Tr2ControllerFloatVariable();
    Object.assign(variable, { name: "Mode", variableType: 3, enumValues: "0=Off, On=1", value: 1 });
    controller.variables.Append(variable);
    const wrapper = new TnyControllers({ wrapped: { name: "Root", controllers: [ controller ], overlayEffects: [], effectChildren: [] } });
    assert.deepEqual(wrapper.GetControllers()[0].variables, [ {
        name: "Mode", type: "enum", value: 1, defaultValue: 0,
        choices: [ { name: "Off", value: 0 }, { name: "On", value: 1 } ]
    } ]);
});
