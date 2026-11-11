import assert from "node:assert/strict";
import test from "node:test";
import { EveDistributionPlacementGeneratorVolume, EveSphereVolume } from "../../npm/dist/trinity/index.js";

for (const hydrated of [false, true])
{
  test(`volume-generator teardown removes ${hydrated ? "hydrated" : "live-set"} subscription while its peer survives`, () =>
  {
    const volume = new EveSphereVolume();
    const owner = new EveDistributionPlacementGeneratorVolume(), peer = new EveDistributionPlacementGeneratorVolume();
    if (hydrated)
    {
      owner._volume = volume;
      owner.Initialize();
    }
    else owner.SetVolume(volume);
    peer.SetVolume(volume);
    assert.equal(volume._callbacks.size, 2);
    owner._isRequestingRegeneration = peer._isRequestingRegeneration = false;
    owner.OnDestruct();
    owner.OnDestruct();
    assert.equal(volume._callbacks.size, 1);
    volume.OnModified("radius");
    assert.equal(owner.IsRequestingRegeneration(), false);
    assert.equal(peer.IsRequestingRegeneration(), true);
    assert.equal(owner.GetVolume(), volume);
    peer.OnDestruct();
    assert.equal(volume._callbacks.size, 0);
  });
}

test("native duplicate acquisition leaves an overwritten subscription outside destructor reach", () =>
{
  const volume = new EveSphereVolume(), generator = new EveDistributionPlacementGeneratorVolume();
  generator.SetVolume(volume);
  const overwritten = generator._volumeCallbackID;
  generator.Initialize();
  assert.equal(volume._callbacks.size, 2);
  try
  {
    generator.OnDestruct();
    generator.OnDestruct();
    assert.equal(volume._callbacks.size, 1);
    generator._isRequestingRegeneration = false;
    volume.OnModified("radius");
    assert.equal(generator.IsRequestingRegeneration(), true);
  }
  finally
  {
    volume.UnregisterForChanges(overwritten);
  }
});
