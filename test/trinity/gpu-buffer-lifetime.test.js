import assert from "node:assert/strict";
import test from "node:test";
import { TriDevice, Tr2Renderer, Tr2GpuBuffer, Tr2GpuStructuredBuffer } from "../../npm/dist/trinity/index.js";
import { ALResult } from "../../npm/dist/trinityal/index.js";
import { PixelFormat } from "../../npm/dist/global/consts/renderContext/index.js";
import { TriStorageFlags } from "../../npm/dist/global/consts/graphics/trinityEnums.js";
import { StubContext } from "../support/stubContext.js";

const SECOND = 10000000;

/** Keeps these tests independent of registrations made by other imported classes. */
function setup(t)
{
    const resources = TriDevice._resourcesRegistered;
    const generations = TriDevice._registeredGenerations;
    const time = TriDevice.activeTime;
    TriDevice._resourcesRegistered = [];
    TriDevice._registeredGenerations = [];
    TriDevice.activeTime = 1000 * SECOND;
    t.after(() =>
    {
        TriDevice._resourcesRegistered = resources;
        TriDevice._registeredGenerations = generations;
        TriDevice.activeTime = time;
    });
    t.mock.method(Tr2Renderer, "IsResourceCreationAllowed", () => true);
    return { device: new TriDevice(), context: StubContext() };
}

for (const Type of [Tr2GpuBuffer, Tr2GpuStructuredBuffer])
{
    const layout = Type === Tr2GpuBuffer ? PixelFormat.PIXEL_FORMAT_R32_FLOAT : 4;

    test(`${Type.name}: binding renews, native release is empty, invalid storage is restored`, t =>
    {
        const { device, context } = setup(t);
        const owner = new Type();
        const prepare = owner._OnPrepareResources;
        t.mock.method(owner, "_OnPrepareResources", () => prepare.call(owner, context));
        assert.equal(device.GetResourcesRegistered().includes(owner), false, "construction does not register a secondary base");
        assert.equal(owner.Create(8, layout, 1, context), ALResult.S_OK);
        assert.equal(device.GetResourcesRegistered().includes(owner), true);
        device._PreparePendingResources();
        const allocated = owner.GetGpuBuffer();

        TriDevice.activeTime += (TriDevice.resourceIdleRule + 1) * SECOND;
        assert.equal(owner.GetGpuBuffer(), allocated);
        device.CollectResources();
        assert.equal(device.GetResourcesRegistered().includes(owner), true, "binding renews residency");
        owner.ReleaseResources(TriStorageFlags.TRISTORAGE_ALL);
        assert.equal(allocated.IsValid(), true, "the native hook intentionally retains its AL value");

        TriDevice.activeTime += (TriDevice.resourceIdleRule + 1) * SECOND;
        device.CollectResources();
        assert.equal(device.GetResourcesRegistered().includes(owner), false);
        assert.equal(allocated.IsValid(), true, "idle collection must not invent a native release");
        allocated.Destroy();
        assert.equal(allocated.IsValid(), false);
        owner.GetGpuBuffer();
        device._PreparePendingResources();
        const restored = owner.GetGpuBuffer();
        assert.notEqual(restored, allocated);
        assert.equal(restored.IsValid(), true);
        assert.equal(owner.GetCount(), 8);
        assert.equal(owner.IsGood(), true);
        restored.Destroy();
    });

    test(`${Type.name}: unconfigured preparation succeeds without allocating`, t =>
    {
        const { device, context } = setup(t);
        const owner = new Type();
        t.mock.method(context, "CreateBuffer", () => { throw new Error("unexpected allocation"); });
        const prepare = owner._OnPrepareResources;
        t.mock.method(owner, "_OnPrepareResources", () => prepare.call(owner, context));
        assert.equal(owner.GetGpuBuffer(), null);
        device._PreparePendingResources();
        assert.equal(owner.IsGood(), true);
        assert.equal(owner.GetGpuBuffer(), null);
    });

    test(`${Type.name}: a failed restore reports failure and retries through device scheduling`, t =>
    {
        const { device, context } = setup(t);
        const owner = new Type();
        assert.equal(owner.Create(4, layout, 1, context), ALResult.S_OK);
        owner.GetGpuBuffer().Destroy();
        const prepare = owner._OnPrepareResources;
        t.mock.method(owner, "_OnPrepareResources", () => prepare.call(owner, context));
        const create = context.CreateBuffer;
        const allocation = t.mock.method(context, "CreateBuffer", () => null);
        device._PreparePendingResources();
        assert.equal(owner.IsGood(), false);
        assert.equal(owner.GetGpuBuffer(), null);
        assert.equal(allocation.mock.callCount(), 1);
        device._PreparePendingResources();
        assert.equal(allocation.mock.callCount(), 1, "failed allocation waits for the retry interval");
        allocation.mock.mockImplementation(create);
        TriDevice.activeTime += SECOND;
        device._PreparePendingResources();
        assert.equal(owner.IsGood(), true);
        assert.equal(owner.GetCount(), 4);
        owner.GetGpuBuffer().Destroy();
    });
}
