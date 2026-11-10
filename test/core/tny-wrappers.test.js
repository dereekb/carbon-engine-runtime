import assert from "node:assert/strict";
import test from "node:test";
import { CjsLibrary } from "../../npm/dist/core/CjsLibrary.js";
import { TnyShip } from "../../npm/dist/wrap/objects/TnyShip.js";
import { TnyScene } from "../../npm/dist/wrap/TnyScene.js";
import { EveShip2 } from "../../npm/dist/trinity/eve/spaceObject/EveShip2.js";
import { EveSpaceScene } from "../../npm/dist/trinity/eve/scene/EveSpaceScene.js";
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
    assert.throws(() => scene.AddObject(first.wrapped), /TnyShip/);
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
