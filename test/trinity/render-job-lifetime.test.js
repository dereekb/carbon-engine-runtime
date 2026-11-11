import test from "node:test";
import assert from "node:assert/strict";
import { TriRenderJob, TriDevice, Tr2Renderer } from "../../npm/dist/trinity/index.js";
import { TriStorageFlags } from "../../npm/dist/global/consts/graphics/trinityEnums.js";
import { StubContext } from "../support/stubContext.js";

test("render-job lifetime follows Carbon's non-Python hooks without calling decorator callbacks", t =>
{
    const job = new TriRenderJob();
    const context = StubContext();
    const previous = TriDevice.activeTime;
    t.after(() => { TriDevice.activeTime = previous; TriDevice.UnregisterResource(job); });
    t.mock.method(Tr2Renderer, "IsResourceCreationAllowed", () => true);
    assert.equal(TriDevice.GetResourcesRegistered().includes(job), false);
    // No duck-typed replacement for Python's SendEvent may be introduced.
    job.DoPrepareResources = () => { throw new Error("Python bridge unexpectedly emulated"); };
    job.DoReleaseResources = job.DoPrepareResources;
    assert.equal(job.Run(0, 0, context), TriRenderJob.Status.RJ_DONE);
    assert.equal(TriDevice.GetResourcesRegistered().includes(job), true);
    assert.equal(job.PrepareResources(), true);
    assert.equal(job.IsGood(), true);
    job.ReleaseResources(TriStorageFlags.TRISTORAGE_ALL);
    TriDevice.activeTime += (TriDevice.resourceIdleRule + 1) * 10000000;
    TriDevice.CollectResources();
    assert.equal(TriDevice.GetResourcesRegistered().includes(job), true, "scheduled infrastructure remains registered");
    job.Run(1, 1, context);
    assert.equal(job._stamp, TriDevice.activeTime);
});
