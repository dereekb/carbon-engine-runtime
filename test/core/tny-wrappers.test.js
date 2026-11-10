import assert from "node:assert/strict";
import test from "node:test";
import { CjsLibrary } from "../../npm/dist/core/CjsLibrary.js";
import { TnyShip } from "../../npm/dist/wrap/objects/TnyShip.js";
import { TnyMobile } from "../../npm/dist/wrap/objects/TnyMobile.js";
import { TnyStationary } from "../../npm/dist/wrap/objects/TnyStationary.js";
import { EveStation2 } from "../../npm/dist/trinity/eve/spaceObject/EveStation2.js";
import { EveMobile } from "../../npm/dist/trinity/eve/spaceObject/EveMobile.js";
import { TnyScene } from "../../npm/dist/wrap/TnyScene.js";
import { EveShip2 } from "../../npm/dist/trinity/eve/spaceObject/EveShip2.js";
import { EveSpaceScene } from "../../npm/dist/trinity/eve/scene/EveSpaceScene.js";
import { Tr2Controller } from "../../npm/dist/trinity/controllers/Tr2Controller.js";
import { Tr2ControllerFloatVariable } from "../../npm/dist/trinity/controllers/expression/Tr2ControllerFloatVariable.js";
import { TnyMotion } from "../../npm/dist/wrap/objects/TnyMotion.js";
import { dirtLevelFromWeeks } from "../../npm/dist/wrap/objects/TnySpaceObject.js";
import { Tr2PostProcess2 } from "../../npm/dist/trinity/postProcess/Tr2PostProcess2.js";

test("ship acquisition preserves the library contract and starts controllers without reinitializing", async t =>
{
    const library = new CjsLibrary(), ship = new EveShip2();
    t.after(() => library.Shutdown());
    await library.Initialize({ sof: null, characterLibrary: null });
    const fetch = t.mock.method(library, "Fetch", async (source, received) =>
    {
        assert.equal(source, "hull:faction:race");
        assert.deepEqual(received, { awaitResources: true });
        return ship;
    });
    const start = t.mock.method(ship, "StartControllers");
    t.mock.method(ship, "Initialize", () => assert.fail("the library already initialized the graph"));
    t.mock.method(library, "Initialize", () => assert.fail("the wrapper borrows its library"));
    const shutdown = t.mock.method(library, "Shutdown");

    const wrapper = await TnyShip.fetch({ dna: "hull:faction:race", awaitResources: true, name: "Rifter" });
    assert.equal(wrapper.wrapped, ship);
    assert.equal(ship.name, "Rifter");
    assert.equal(Object.hasOwn(wrapper, "library"), false);
    assert.equal(fetch.mock.callCount(), 1);
    assert.equal(start.mock.callCount(), 1);
    assert.equal(shutdown.mock.callCount(), 0);
});

test("ship acquisition rejects null, incompatible graphs and provider/controller failures", async t =>
{
    const library = new CjsLibrary();
    t.after(() => library.Shutdown());
    await library.Initialize({ sof: null, characterLibrary: null });
    let result = null;
    t.mock.method(library, "Fetch", async () => result);
    await assert.rejects(TnyShip.fetch({ dna: "a:b:c" }), /live EveShip2/);
    result = {};
    await assert.rejects(TnyShip.fetch({ dna: "a:b:c" }), /live EveShip2/);
    result = new EveShip2();
    const controllerFailure = new Error("controller failed");
    t.mock.method(result, "StartControllers", () => { throw controllerFailure; });
    await assert.rejects(TnyShip.fetch({ dna: "a:b:c" }), error => error === controllerFailure);
    const loadFailure = new Error("catalog failed");
    t.mock.method(library, "Fetch", async () => { throw loadFailure; });
    await assert.rejects(TnyShip.fetch({ dna: "a:b:c" }), error => error === loadFailure);
    await assert.rejects(TnyShip.fetch({}), /DNA or an object path/);
    await assert.rejects(TnyShip.fetch({ dna: "a:b:c", resPath: "res:/a.black" }), /DNA or an object path/);
    await assert.rejects(TnyShip.fetch({ dna: "a:b:c", typeID: 587 }), /does not take typeID/);
    await library.Shutdown();
    await assert.rejects(TnyShip.fetch({ dna: "a:b:c" }), /initialized CjsLibrary/);
});

test("Fetch waits on resMan's Watch only when awaitResources is set, and forwards the rest", async t =>
{
    const library = new CjsLibrary(), ship = new EveShip2();
    t.after(() => library.Shutdown());
    await library.Initialize({ sof: null, characterLibrary: null });
    const { blue } = await import("../../npm/dist/blue/index.js");
    const fetch = t.mock.method(blue.resMan, "Fetch", async (_path, received) =>
    {
        assert.deepEqual(received, { other: 1 });
        return ship;
    });
    const watch = t.mock.method(blue.resMan, "Watch", async root => ({ object: root, failed: [] }));
    assert.equal(await library.Fetch("res:/ship.black", { other: 1 }), ship);
    assert.equal(watch.mock.callCount(), 0);
    assert.equal(await library.Fetch("res:/ship.black", { other: 1, awaitResources: true }), ship);
    assert.equal(watch.mock.callCount(), 1);
    assert.equal(watch.mock.calls[0].arguments[0], ship);
    assert.equal(fetch.mock.callCount(), 2);
});

test("scene acquisition and adaptation preserve the existing scene and failures", async t =>
{
    const library = new CjsLibrary(), scene = new EveSpaceScene();
    t.after(() => scene.Destruct());
    t.after(() => library.Shutdown());
    await library.Initialize({ sof: null, characterLibrary: null });
    const options = { callerOption: {} };
    t.mock.method(library, "Fetch", async (path, received) =>
    {
        assert.equal(path, "res:/scene.black");
        assert.equal(received, options);
        return scene;
    });
    t.mock.method(scene, "Initialize", () => assert.fail("adaptation never initializes again"));
    const wrapper = await TnyScene.fetch("res:/scene.black", options);
    assert.equal(wrapper.wrapped, scene);
    assert.equal(Object.hasOwn(wrapper, "library"), false);
    assert.equal(TnyScene.fromWrapped(scene).wrapped, scene);
    assert.throws(() => TnyScene.fromWrapped(null), /live EveSpaceScene/);
    assert.throws(() => TnyScene.fromWrapped(new EveShip2()), /live EveSpaceScene/);
    const failure = new Error("scene missing");
    t.mock.method(library, "Fetch", async () => { throw failure; });
    await assert.rejects(TnyScene.fetch("res:/scene.black"), error => error === failure);
});

test("membership uses native notifications and never clears on absent removal", t =>
{
    const nativeScene = new EveSpaceScene();
    t.after(() => nativeScene.Destruct());
    const scene = TnyScene.fromWrapped(nativeScene);
    const first = new TnyShip(new EveShip2());
    const second = new TnyShip(new EveShip2());
    const absent = new TnyShip(new EveShip2());
    const notify = t.mock.method(nativeScene, "OnListModified");
    const start = t.mock.method(first.wrapped, "StartControllers");

    assert.equal(scene.AddObject(first), true);
    assert.equal(scene.AddObject(first), false);
    assert.equal(scene.AddObject(second), true);
    assert.equal(nativeScene.objects.length, 2);
    assert.equal(notify.mock.callCount(), 2);
    assert.equal(start.mock.callCount(), 0, "adding does not restart controllers");
    assert.equal(scene.RemoveObject(absent), false);
    assert.equal(nativeScene.objects.length, 2, "Remove(-1) would incorrectly clear both ships");
    assert.throws(() => scene.AddObject(first.wrapped), /TnySpaceObject/);
    assert.equal(scene.RemoveObject(first), true);
    assert.equal(nativeScene.objects[0], second.wrapped);
    assert.equal(scene.RemoveObject(first), false);
    assert.equal(notify.mock.callCount(), 3);
    assert.equal(scene.RemoveObject(second), true);
});

test("shared library is published only after initialization and cleared on shutdown or failure", async t =>
{
    const library = new CjsLibrary(), other = new CjsLibrary();
    t.after(() => library.Shutdown());
    t.after(() => other.Shutdown());
    assert.equal(CjsLibrary.instance, null);
    await assert.rejects(TnyScene.fetch("res:/scene.black"), /initialized CjsLibrary/);
    const initializing = library.Initialize({ sof: null, characterLibrary: null });
    assert.equal(CjsLibrary.instance, null, "in-flight startup is not published");
    await assert.rejects(other.Initialize(), /already active/);
    await initializing;
    assert.equal(CjsLibrary.instance, library);
    assert.equal(await library.Initialize(), library);
    await library.Shutdown();
    assert.equal(CjsLibrary.instance, null);
    await assert.rejects(other.Initialize({ paths: {} }));
    assert.equal(CjsLibrary.instance, null, "failed startup must release the shared slot");
    await other.Initialize({ sof: null, characterLibrary: null });
    assert.equal(CjsLibrary.instance, other);
});

test("scene post process loads a template by name or path and restores the authored one", async t =>
{
    const library = new CjsLibrary(), nativeScene = new EveSpaceScene();
    t.after(() => nativeScene.Destruct());
    t.after(() => library.Shutdown());
    await library.Initialize({ sof: null, characterLibrary: null });
    const authored = new Tr2PostProcess2(), loaded = new Tr2PostProcess2();
    nativeScene.postprocess = authored;
    const paths = [];
    t.mock.method(library, "Fetch", async path => { paths.push(path); return path.endsWith("bad.black") ? {} : loaded; });
    const scene = TnyScene.fromWrapped(nativeScene);

    assert.equal(await scene.SetPostProcess("env_amarr_01a"), "res:/dx9/postprocess/environmenttemplate/env_amarr_01a.black");
    assert.equal(nativeScene.postprocess, loaded);
    assert.equal(await scene.SetPostProcess("res:/other/post.black"), "res:/other/post.black");
    assert.deepEqual(paths, [ "res:/dx9/postprocess/environmenttemplate/env_amarr_01a.black", "res:/other/post.black" ]);
    await assert.rejects(scene.SetPostProcess("res:/bad.black"), /not a Tr2PostProcess2/);
    assert.equal(nativeScene.postprocess, loaded, "a rejected load leaves the post process");
    assert.equal(await scene.SetPostProcess(null), null);
    assert.equal(nativeScene.postprocess, authored);
    assert.equal(scene.postProcessPath, null);
});

test("scene tracks the wrappers it shows", t =>
{
    const nativeScene = new EveSpaceScene();
    t.after(() => nativeScene.Destruct());
    const scene = TnyScene.fromWrapped(nativeScene);
    const first = new TnyShip(new EveShip2()), second = new TnyShip(new EveShip2());
    scene.AddObject(first);
    scene.AddObject(second);
    scene.AddObject(first);
    assert.deepEqual(scene.GetObjects(), [ first, second ]);
    scene.RemoveObject(first);
    scene.RemoveObject(first);
    assert.deepEqual(scene.GetObjects(), [ second ]);
});

test("scene Fetch wraps each object in its most specific wrapper and adds it", async t =>
{
    const library = new CjsLibrary(), nativeScene = new EveSpaceScene();
    t.after(() => nativeScene.Destruct());
    t.after(() => library.Shutdown());
    await library.Initialize({ sof: null, characterLibrary: null });
    const objects = { ship: new EveShip2(), station: new EveStation2(), mobile: new EveMobile() };
    for (const object of Object.values(objects)) t.mock.method(object, "StartControllers");
    t.mock.method(library, "Fetch", async source => objects[source.split(":")[0]] ?? null);
    const scene = TnyScene.fromWrapped(nativeScene);

    const ship = await scene.Fetch({ dna: "ship:a:b" });
    const station = await scene.Fetch({ dna: "station:a:b", name: "Home" });
    const mobile = await scene.Fetch({ dna: "mobile:a:b" });
    assert.equal(ship.constructor, TnyShip);
    assert.equal(station.constructor, TnyStationary);
    assert.equal(mobile.constructor, TnyMobile);
    assert.equal(objects.station.name, "Home");
    assert.deepEqual(scene.GetObjects(), [ ship, station, mobile ]);
    assert.equal(objects.ship.StartControllers.mock.callCount(), 1);
    await assert.rejects(scene.Fetch({ dna: "none:a:b" }), /live EveSpaceObject2/);
    await assert.rejects(TnyShip.fetch({ dna: "station:a:b" }), /TnyShip requires a live EveShip2/);
});

test("ship parameters are discovered from the object and written through native owners", t =>
{
    const ship = new TnyShip(new EveShip2());
    const names = ship.GetParameters().map(parameter => parameter.name);
    for (const name of [ "dirtLevel", "age", "activationStrength", "shieldDamage", "armorDamage", "hullDamage", "shieldboost", "speed", "maxSpeed" ])
        assert.ok(names.includes(name), name);
    assert.ok(!names.includes("displayKillCounterValue"), "no kill-counter decal, no kill marks");
    assert.ok(!names.some(name => name.startsWith("boosters.")), "no booster set, no booster values");
    assert.throws(() => ship.SetParameter("boosters.alwaysOn", true), /has no parameter/);
    assert.throws(() => ship.SetParameter("dirtLevel", 2), /from 0 to 1/);
    assert.throws(() => ship.SetParameter("shieldboost", 1), /boolean/);

    ship.SetParameter("dirtLevel", 0.25);
    assert.equal(ship.wrapped.dirtLevel, 0.25);
    ship.SetParameter("age", 10);
    assert.equal(ship.GetParameter("age"), 10);
    assert.ok(Math.abs(ship.wrapped.dirtLevel - dirtLevelFromWeeks(10)) < 1e-6);

    const damage = t.mock.method(ship.wrapped, "SetImpactDamageState");
    ship.SetParameter("armorDamage", 0.25);
    assert.deepEqual(damage.mock.calls[0].arguments, [ 1, 0.75, 1, true ], "remaining shield, armour, hull");
    const animation = t.mock.method(ship.wrapped, "SetImpactAnimation");
    ship.SetParameter("armorrepair", true);
    assert.deepEqual(animation.mock.calls[0].arguments.slice(0, 2), [ "armorrepair", true ]);
    assert.equal(ship.GetParameter("armorrepair"), true);
});

test("speed moves the ship along its heading through its translation curve", () =>
{
    const ship = new TnyShip(new EveShip2());
    ship.SetParameter("speed", 100);
    assert.ok(ship.wrapped.translationCurve instanceof TnyMotion);
    assert.equal(ship.wrapped.maxSpeed, 250, "a ship with no max speed takes the booster default");
    assert.equal(ship.GetParameter("speed"), 100);
    const motion = ship.wrapped.translationCurve, out = new Float32Array(3);
    motion.Update__Ticks(0, out);
    motion.Update__Ticks(2e7, out);
    assert.deepEqual(Array.from(out), [ 0, 0, 200 ], "two seconds at 100 m/s along +Z");
    ship.SetParameter("speed", 0);
    motion.Update__Ticks(4e7, out);
    assert.deepEqual(Array.from(out), [ 0, 0, 200 ], "a stop holds the position reached");
    assert.deepEqual(Array.from(motion.GetValueDotAt__Ticks(4e7, out)), [ 0, 0, 0 ]);
});

test("ship states: three always, siege and attack only where controllers declare them, set exclusively", t =>
{
    const native = new EveShip2(), controller = new Tr2Controller();
    controller.name = "shipStates";
    const variable = (name, variableType = 2, enumValues = "") =>
    {
        const entry = new Tr2ControllerFloatVariable();
        Object.assign(entry, { name, variableType, enumValues });
        controller.variables.Append(entry);
    };
    variable("IsWarping");
    variable("InSiegeMode");
    variable("WarpTopSpeed", 0);
    variable("shipStance", 3, "defense = 1, sharpshooter = 2, propulsion = 3");
    native.controllers.Append(controller);
    const ship = new TnyShip(native);

    assert.deepEqual(ship.GetStates(), [ "standard", "warp", "dock", "siege" ]);
    const exposure = ship.controllers.GetControllers();
    assert.equal(exposure[0].name, "shipStates");
    assert.deepEqual(exposure[0].variables.map(entry => entry.name), [ "IsWarping", "InSiegeMode", "WarpTopSpeed", "shipStance" ]);
    assert.deepEqual(ship.GetStances().choices.map(choice => choice.name), [ "defense", "sharpshooter", "propulsion" ]);

    const set = t.mock.method(native, "SetControllerVariable");
    ship.SetState("siege");
    const written = Object.fromEntries(set.mock.calls.map(call => call.arguments));
    assert.deepEqual(written, { IsWarping: 0, isDocked: 0, InSiegeMode: 1 }, "WarpTopSpeed is no state flag");
    assert.equal(ship.GetState(), "siege");
    assert.throws(() => ship.SetState("attack"), /no state attack/);
    ship.SetStance(2);
    assert.deepEqual(set.mock.calls.at(-1).arguments, [ "shipStance", 2 ]);
});
