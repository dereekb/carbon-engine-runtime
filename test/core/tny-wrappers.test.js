import assert from "node:assert/strict";
import test from "node:test";
import { CjsLibrary } from "../../npm/dist/core/CjsLibrary.js";
import { TnyShip } from "../../npm/dist/wrap/objects/TnyShip.js";
import { TnyScene } from "../../npm/dist/wrap/TnyScene.js";
import { EveShip2 } from "../../npm/dist/trinity/eve/spaceObject/EveShip2.js";
import { EveSpaceScene } from "../../npm/dist/trinity/eve/scene/EveSpaceScene.js";

test("ship acquisition preserves the library contract and starts controllers without reinitializing", async t =>
{
    const library = new CjsLibrary(), ship = new EveShip2();
    const options = { callerOption: {} };
    const fetch = t.mock.method(library, "Fetch", async (source, received) =>
    {
        assert.equal(source, "hull:faction:race");
        assert.equal(received, options);
        return ship;
    });
    const start = t.mock.method(ship, "StartControllers");
    t.mock.method(ship, "Initialize", () => assert.fail("the library already initialized the graph"));
    t.mock.method(library, "Initialize", () => assert.fail("the wrapper borrows its library"));
    t.mock.method(library, "Shutdown", () => assert.fail("the wrapper borrows its library"));

    const wrapper = await TnyShip.fetch(library, "hull:faction:race", options);
    assert.equal(wrapper.wrapped, ship);
    assert.equal(wrapper.library, library);
    assert.equal(fetch.mock.callCount(), 1);
    assert.equal(start.mock.callCount(), 1);
});

test("ship acquisition rejects null, incompatible graphs and provider/controller failures", async t =>
{
    const library = new CjsLibrary();
    let result = null;
    t.mock.method(library, "Fetch", async () => result);
    await assert.rejects(TnyShip.fetch(library, "a:b:c"), /live EveShip2/);
    result = {};
    await assert.rejects(TnyShip.fetch(library, "a:b:c"), /live EveShip2/);
    result = new EveShip2();
    const controllerFailure = new Error("controller failed");
    t.mock.method(result, "StartControllers", () => { throw controllerFailure; });
    await assert.rejects(TnyShip.fetch(library, "a:b:c"), error => error === controllerFailure);
    const loadFailure = new Error("catalog failed");
    t.mock.method(library, "Fetch", async () => { throw loadFailure; });
    await assert.rejects(TnyShip.fetch(library, "a:b:c"), error => error === loadFailure);
    await assert.rejects(TnyShip.fetch(library, {}), /DNA or an object path/);
    await assert.rejects(TnyShip.fetch(null, "a:b:c"), /CjsLibrary/);
});

test("scene acquisition and adaptation preserve the existing scene and failures", async t =>
{
    const library = new CjsLibrary(), scene = new EveSpaceScene();
    t.after(() => scene.Destruct());
    const options = { callerOption: {} };
    t.mock.method(library, "Fetch", async (path, received) =>
    {
        assert.equal(path, "res:/scene.black");
        assert.equal(received, options);
        return scene;
    });
    t.mock.method(scene, "Initialize", () => assert.fail("adaptation never initializes again"));
    const wrapper = await TnyScene.fetch(library, "res:/scene.black", options);
    assert.equal(wrapper.wrapped, scene);
    assert.equal(wrapper.library, library);
    assert.equal(TnyScene.fromWrapped(library, scene).wrapped, scene);
    assert.throws(() => TnyScene.fromWrapped(library, null), /live EveSpaceScene/);
    assert.throws(() => TnyScene.fromWrapped(library, new EveShip2()), /live EveSpaceScene/);
    const failure = new Error("scene missing");
    t.mock.method(library, "Fetch", async () => { throw failure; });
    await assert.rejects(TnyScene.fetch(library, "res:/scene.black"), error => error === failure);
});

test("membership uses native notifications, rejects cross-library ships, and never clears on absent removal", t =>
{
    const library = new CjsLibrary(), nativeScene = new EveSpaceScene();
    t.after(() => nativeScene.Destruct());
    const scene = TnyScene.fromWrapped(library, nativeScene);
    const first = new TnyShip(library, new EveShip2());
    const second = new TnyShip(library, new EveShip2());
    const absent = new TnyShip(library, new EveShip2());
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
    assert.throws(() => scene.AddObject(new TnyShip(new CjsLibrary(), new EveShip2())), /same library/);
    assert.throws(() => scene.AddObject(first.wrapped), /TnyShip/);
    assert.equal(scene.RemoveObject(first), true);
    assert.equal(nativeScene.objects[0], second.wrapped);
    assert.equal(scene.RemoveObject(first), false);
    assert.equal(notify.mock.callCount(), 3);
    assert.equal(scene.RemoveObject(second), true);
});
