import assert from "node:assert/strict";
import test from "node:test";
import { CjsPaperDoll, CjsPaperDollCompositor, PaperDollTarget } from "../../../npm/dist/character/index.js";
import { Tr2Renderer, Tr2RenderContext_GetMainThreadRenderContext, TriDevice } from "../../../npm/dist/trinity/index.js";
import { Tr2RenderContextALStub } from "../../../npm/dist/trinityal/index.js";

// A doll's composition targets are drawn once and sampled after. Liveness flows through owners' IsGood
// (device-resource-registration.md): CjsPaperDoll.IsGood asks its compositors, and a compositor asks the targets it
// owns, which renews them. So a live doll keeps its targets, drawn or not. One that stops being asked lets them
// lapse; the idle sweep frees them, the device tick recreates them blank, and the doll's next Update hands their
// bits to CjsPaperDollInstance.RebuildTargets so they are baked again.

const SECOND = 10000000;
const build = { CheckActive() {}, Ready: value => value };

/** A device with an empty registry, a settable clock, and the stub backend on the main-thread context. */
function setup(t)
{
    const oldResources = TriDevice._resourcesRegistered, oldGenerations = TriDevice._registeredGenerations;
    const previousActiveTime = TriDevice.activeTime;
    const context = Tr2RenderContext_GetMainThreadRenderContext(), previousAL = context.GetRenderContextAL();

    TriDevice._resourcesRegistered = [];
    TriDevice._registeredGenerations = [];
    TriDevice.activeTime = 1000 * SECOND;

    const al = new Tr2RenderContextALStub();
    al.CreateDevice({ mode: { width: 64, height: 64 } });
    context.SetRenderContextAL(al);
    t.mock.method(Tr2Renderer, "IsResourceCreationAllowed", () => true);

    t.after(() =>
    {
        context.SetRenderContextAL(previousAL);
        TriDevice.activeTime = previousActiveTime;
        TriDevice._resourcesRegistered = oldResources;
        TriDevice._registeredGenerations = oldGenerations;
    });

    return { device: new TriDevice(), context, at: seconds => { TriDevice.activeTime = (1000 + seconds) * SECOND; } };
}

/** A doll with one compositor owning a head target, and a front instance that records what it is asked to rebuild. */
function doll(t, context)
{
    const compositor = new CjsPaperDollCompositor(context, build);
    t.after(() => compositor.Destruct());
    // The stub draws nothing and no frame clock runs here; the blit and the frame brackets are stood in so Draw's own
    // target handling runs.
    t.mock.method(compositor.blitter, "Draw__Effect", () => true);
    for (const name of [ "BeginFrame", "EndFrame", "BeginRenderContext", "EndRenderContext" ]) t.mock.method(Tr2Renderer, name, () => {});

    const target = compositor.MakeTarget(16, 16, false, PaperDollTarget.HEAD);
    const character = new CjsPaperDoll();
    character.compositors = [ compositor ];

    const rebuilt = [];
    let bakes = 0;
    character.front = {
        objects: [],
        RebuildTargets(bits) { rebuilt.push(bits); },
        Update()
        {
            if (!rebuilt.length) return false;
            compositor.Draw(target, 16, 16, {}, CjsPaperDollCompositor.full, true);
            bakes += 1;
            return true;
        }
    };
    return { character, compositor, target, rebuilt, bakes: () => bakes };
}

test("a live doll that is not drawn keeps its composition targets", t =>
{
    const { device, context, at } = setup(t);
    const { character, compositor, target, rebuilt } = doll(t, context);
    const surface = target.GetRenderTarget();
    device._PreparePendingResources();
    assert.equal(character.IsGood(), true, "nothing is loading and the target is prepared");
    compositor.TakeReleasedTargets();

    // Nothing samples or draws the target here: only the owner's IsGood reaches it.
    for (let seconds = 10; seconds <= 4 * TriDevice.resourceIdleRule; seconds += 10)
    {
        at(seconds);
        character.IsGood();
        device.CollectResources();
    }

    assert.equal(surface.IsValid(), true, "renewed through the compositor that owns it");
    assert.equal(target._renderTarget, surface);
    assert.equal(character.Update(), false);
    assert.deepEqual(rebuilt, [], "nothing was released, so nothing is baked again");
});

test("a doll that stops being asked has its targets freed, and its next Update bakes them again", t =>
{
    const { device, context, at } = setup(t);
    const { character, compositor, target, rebuilt, bakes } = doll(t, context);
    const surface = target.GetRenderTarget();
    const revision = compositor._targetRevisions.get(target);
    device._PreparePendingResources();
    compositor.TakeReleasedTargets();

    at(TriDevice.resourceIdleRule + 1);
    device.CollectResources();
    assert.equal(surface.IsValid(), false, "the idle sweep freed the target");
    assert.equal(target._renderTarget, null);

    // The doll is used again. It is not good until the device tick has prepared the target, and a bake attempted
    // before then draws nothing.
    assert.equal(character.IsGood(), false);
    assert.equal(character.Update(), true);
    assert.deepEqual(rebuilt, [ PaperDollTarget.HEAD ], "the freed target's bit goes to RebuildTargets");
    assert.equal(compositor._targetRevisions.get(target), revision, "no surface yet, so nothing was drawn");

    device._PreparePendingResources();
    assert.equal(character.IsGood(), true, "the tick recreated the target");
    const recreated = target.GetRenderTarget();
    assert.ok(recreated && recreated.IsValid() && recreated !== surface, "blank, so it must be baked again");

    assert.equal(character.Update(), true);
    assert.deepEqual(rebuilt, [ PaperDollTarget.HEAD, PaperDollTarget.HEAD ]);
    assert.equal(compositor._targetRevisions.get(target), revision + 1, "this time the bake drew into the target");
    assert.equal(bakes(), 2);
    assert.equal(compositor.TakeReleasedTargets(), 0, "nothing is left to bake");
});

test("a target made without bits asks for every target", t =>
{
    const { device, context, at } = setup(t);
    const compositor = new CjsPaperDollCompositor(context, build);
    t.after(() => compositor.Destruct());
    compositor.MakeTarget(8, 8);
    device._PreparePendingResources();
    compositor.TakeReleasedTargets();

    at(TriDevice.resourceIdleRule + 1);
    device.CollectResources();
    assert.equal(compositor.TakeReleasedTargets(), ~0);
});
