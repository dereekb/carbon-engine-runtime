import assert from "node:assert/strict";
import test from "node:test";
import { CjsSchema } from "../../npm/dist/blue/schema/index.js";
import { CjsGraph } from "../../npm/dist/global/model/graph/index.js";
import {
  EveBannerSet,
  EveChildCloud,
  EveChildCloud2,
  EveChildLineSet,
  EveTrailsSet,
  Tr2DeviceResource,
  Tr2Renderer,
  TriDevice, trinity
} from "../../npm/dist/trinity/index.js";

test("Tr2DeviceResource registers on construction and gates preparation on resource creation (cpp:6-27)", t =>
{
  const calls = [];
  class Resource extends Tr2DeviceResource
  {
    _OnPrepareResources()
    {
      calls.push("prepare");
      return false;
    }

    ReleaseResources() {}
  }

  CjsGraph.defineLifetime(Resource, { bases: [ Tr2DeviceResource ] });
  const resource = new Resource();
  assert.ok(TriDevice.GetResourcesRegistered().includes(resource), "the constructor registers");
  assert.equal(resource.GetDescription(), "<Unknown>");

  t.mock.method(Tr2Renderer, "IsResourceCreationAllowed", () => false);
  assert.equal(resource.PrepareResources(), true, "nothing is created mid-reset, and that succeeds");
  assert.deepEqual(calls, []);

  Tr2Renderer.IsResourceCreationAllowed.mock.mockImplementation(() => true);
  assert.equal(resource.PrepareResources(), false, "a failed _OnPrepareResources fails the prepare");
  assert.deepEqual(calls, [ "prepare" ]);

  const peer = new Resource();
  const release = t.mock.method(resource, "ReleaseResources", () => assert.fail("base destruction must not dispatch resource release"));
  for (let repeat = 0; repeat < 2; repeat++)
  {
    resource.Destruct();
    assert.equal(TriDevice.GetResourcesRegistered().includes(resource), false);
    assert.equal(TriDevice.GetResourcesRegistered().includes(peer), true);
    assert.equal(release.mock.callCount(), 0);
  }
  peer.Destruct();
  assert.equal(TriDevice.GetResourcesRegistered().includes(peer), false);
});

test("Tr2DeviceResource's two obligations are abstract", () =>
{
  const resource = new Tr2DeviceResource();
  assert.throws(() => resource.ReleaseResources(0), /ReleaseResources/u);
  assert.throws(() => resource._OnPrepareResources(), /_OnPrepareResources/u);
  resource.Destruct();
});

test("the classes Carbon derives from Tr2DeviceResource take its PrepareResources", () =>
{
  for (const Class of [ EveBannerSet, EveTrailsSet, EveChildCloud, EveChildCloud2, EveChildLineSet ])
  {
    assert.equal(Class.prototype.PrepareResources, Tr2DeviceResource.prototype.PrepareResources, CjsSchema.getClassName(Class));
  }
});
