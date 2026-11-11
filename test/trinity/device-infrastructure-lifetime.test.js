import assert from "node:assert/strict";
import test from "node:test";
import {
    TriDevice, Tr2Renderer, Tr2RingVertexBuffer, Tr2RingIndexBuffer,
    Tr2QuadRenderer, Tr2VertexDefinition, TriDebugTextRenderer, Tr2OcclusionBuffer,
    Tr2RenderContext_GetMainThreadRenderContext
} from "../../npm/dist/trinity/index.js";
import { TriStorageFlags } from "../../npm/dist/global/consts/graphics/trinityEnums.js";
import { Tr2RenderContextALStub, Tr2BufferAL, Tr2FenceAL, ALResult } from "../../npm/dist/trinityal/index.js";

const SECOND = 10000000;

/** Uses a real stub context and isolates the device's timed registry. */
function setup(t)
{
    const resources = TriDevice._resourcesRegistered;
    const generations = TriDevice._registeredGenerations;
    const time = TriDevice.activeTime;
    TriDevice._resourcesRegistered = [];
    TriDevice._registeredGenerations = [];
    TriDevice.activeTime = 1000 * SECOND;
    const context = Tr2RenderContext_GetMainThreadRenderContext();
    const previousAL = context.GetRenderContextAL();
    const al = new Tr2RenderContextALStub();
    al.CreateDevice({ mode: { width: 64, height: 64 } });
    context.SetRenderContextAL(al);
    t.after(() =>
    {
        context.SetRenderContextAL(previousAL);
        TriDevice._resourcesRegistered = resources;
        TriDevice._registeredGenerations = generations;
        TriDevice.activeTime = time;
    });
    t.mock.method(Tr2Renderer, "IsResourceCreationAllowed", () => true);
    return { context, device: new TriDevice(), expire: () => { TriDevice.activeTime += (TriDevice.resourceIdleRule + 1) * SECOND; } };
}

for (const Type of [Tr2RingVertexBuffer, Tr2RingIndexBuffer])
{
    test(`${Type.name}: destruction releases owned buffer and pooled fences without invalidating copies`, t =>
    {
        const { context, device } = setup(t);
        const ring = new Type();
        assert.equal(ring.Create(32, 4), true);
        assert.equal(ring.PutData(new Uint8Array(8), 8, 4, context).result, ALResult.S_OK);
        ring.DoneUsingData(context);
        const buffer = ring.GetBuffer();
        const bufferPeer = new Tr2BufferAL({ copy: buffer });
        const activeFence = ring._regions[0].fence;
        const fencePeer = new Tr2FenceAL({ copy: activeFence });
        const pooledFence = ring.AllocateFence();
        ring.DeallocateFence(pooledFence);
        assert.equal(activeFence.IsValid(), true);
        assert.equal(pooledFence.IsValid(), true);
        assert.equal(device.GetResourcesRegistered().includes(ring), true);
        const pooledImplementation = pooledFence._fence.implementation;
        const bufferImplementation = buffer.TrinityALImpl_GetObject();
        const fenceImplementation = activeFence._fence.implementation;
        try
        {
            for (let repeat = 0; repeat < 2; repeat++)
            {
                ring.Destruct();
                assert.equal(device.GetResourcesRegistered().includes(ring), false);
                assert.equal(ring._buffer, null);
                assert.equal(buffer.IsValid(), false);
                assert.equal(activeFence.IsValid(), false);
                assert.equal(pooledFence.IsValid(), false);
                assert.equal(pooledImplementation.IsValid(), false);
                assert.equal(ring._regions.length, 0);
                assert.equal(ring._availableFences.length, 0);
                assert.equal(bufferPeer.IsValid(), true);
                assert.equal(fencePeer.IsValid(), true);
            }
            assert.equal(fencePeer.Wait(context), ALResult.S_OK);
            assert.equal(bufferPeer.MapForWriting(context).result, ALResult.S_OK);
            bufferPeer.UnmapForWriting(context);
        }
        finally
        {
            bufferPeer.Destroy();
            fencePeer.Destroy();
        }
        assert.equal(bufferImplementation.IsValid(), false);
        assert.equal(fenceImplementation.IsValid(), false);
    });

    test(`${Type.name}: inherited registration, idle release and retained-size recovery`, t =>
    {
        const { context, device, expire } = setup(t);
        const ring = new Type();
        assert.equal(device.GetResourcesRegistered().includes(ring), false);
        assert.equal(ring.Create(32, 4), true);
        assert.equal(device.GetResourcesRegistered().includes(ring), true);
        const before = ring.GetBuffer();
        const size = ring.GetBufferSize();
        assert.equal(ring.IsGood(), true);
        expire();
        assert.equal(ring.PutData(new Uint8Array(8), 8, 4, context).result, ALResult.S_OK);
        device.CollectResources();
        assert.equal(before.IsValid(), true, "a write renews residency");
        expire();
        device.CollectResources();
        assert.equal(before.IsValid(), false);
        assert.equal(ring._regions.length, 0);
        assert.equal(ring._availableFences.length, 0);
        assert.equal(ring.GetBuffer(), null, "binding queues recovery without allocation");
        device._PreparePendingResources();
        assert.equal(ring.GetBuffer().IsValid(), true);
        assert.equal(ring.GetBufferSize(), size);
        assert.equal(ring.PutData(new Uint8Array(8), 8, 4, context).result, ALResult.S_OK);
        ring.ReleaseResources(TriStorageFlags.TRISTORAGE_ALL);
    });
}

test("quad renderer registers on rendering; managed release invalidates declarations for rebuild", t =>
{
    const { context, device, expire } = setup(t);
    const renderer = new Tr2QuadRenderer();
    const definition = new Tr2VertexDefinition();
    definition.Add("FLOAT32_2", "TEXCOORD", 0, 1, 1);
    renderer.RegisterEffect("fixture", 0, 8, 1, definition, null);
    renderer.BeginRendering(context);
    assert.equal(device.GetResourcesRegistered().includes(renderer), true);
    const record = renderer.GetEffectRecords().get("fixture");
    const handle = record.vertexDeclHandle;
    expire();
    device.CollectResources();
    assert.equal(device.GetResourcesRegistered().includes(renderer), true, "infrastructure is not timer-purged");
    renderer.ReleaseResources(TriStorageFlags.TRISTORAGE_VIDEOMEMORY);
    assert.equal(record.vertexDeclHandle, handle);
    renderer.ReleaseResources(TriStorageFlags.TRISTORAGE_MANAGEDMEMORY);
    assert.notEqual(record.vertexDeclHandle, handle);
    assert.equal(renderer.PrepareResources(), true);
    assert.equal(record.vertexDeclHandle, handle);
});

test("debug text registers on draw, frees its AL storage on release and redraws", t =>
{
    const { context, device, expire } = setup(t);
    const draw = t.mock.method(Tr2Renderer, "drawTexture", () => true);
    const renderer = new TriDebugTextRenderer();
    const rect = { left: 0, top: 0, right: 64, bottom: 64 };
    const render = () => renderer.PrintfImmediate(context, 0, rect, 0, [1, 1, 1, 1], "A");
    render();
    assert.equal(device.GetResourcesRegistered().includes(renderer), true);
    assert.equal(draw.mock.callCount(), 1);
    const before = renderer._texture;
    const storage = before.TrinityALImpl_GetObject();
    expire();
    device.CollectResources();
    assert.equal(before.IsValid(), true);
    renderer.ReleaseResources(TriStorageFlags.TRISTORAGE_ALL);
    assert.equal(before.IsValid(), false);
    assert.equal(storage.IsRegistered(), false, "release destroys the old AL value, not just its wrapper reference");
    device._PreparePendingResources();
    render();
    assert.equal(draw.mock.callCount(), 2);
    assert.equal(renderer._texture.IsValid(), true);
    renderer.ReleaseResources(TriStorageFlags.TRISTORAGE_ALL);
});

test("occlusion service registers on allocation and only managed release requeues clear slots", t =>
{
    const { context, device, expire } = setup(t);
    const renderer = new Tr2OcclusionBuffer();
    renderer.AllocateOffset();
    assert.equal(device.GetResourcesRegistered().includes(renderer), true);
    renderer.clear.length = 0;
    renderer.ReleaseResources(TriStorageFlags.TRISTORAGE_VIDEOMEMORY);
    assert.deepEqual(renderer.clear, []);
    renderer.ReleaseResources(TriStorageFlags.TRISTORAGE_MANAGEDMEMORY);
    assert.deepEqual(renderer.clear, [0, 13, 26, 39]);
    const compute = t.mock.method(Tr2Renderer, "runComputeShader", () => true);
    renderer.ProcessBuffer(context);
    assert.equal(compute.mock.callCount(), 5);
    assert.deepEqual(renderer.clear, []);
    expire();
    device.CollectResources();
    assert.equal(device.GetResourcesRegistered().includes(renderer), true);
    renderer.buffer.Destruct();
});
