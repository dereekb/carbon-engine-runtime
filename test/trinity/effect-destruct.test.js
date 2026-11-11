import assert from "node:assert/strict";
import test from "node:test";
import { blue, BlueResMan } from "../../npm/dist/blue/index.js";
import { Tr2Effect, Tr2EffectRes, TriTextureParameter, Tr2Vector4Parameter } from "../../npm/dist/trinity/shader/index.js";

test("effect teardown detaches shared material resources and cached handles without clearing authored lists", () =>
{
  const previous = blue.resMan, manager = new BlueResMan();
  blue.resMan = manager;
  try
  {
    const effect = new Tr2Effect(), peer = new Tr2Effect();
    const texture = new TriTextureParameter(), parameter = new Tr2Vector4Parameter();
    const resource = new Tr2EffectRes();
    effect.resources.Append(texture);
    peer.resources.Append(texture);
    texture.OnAddedToMaterial(effect);
    texture.OnAddedToMaterial(peer);
    effect.parameters.Append(parameter);
    effect.effectResource = peer.effectResource = resource;
    manager.notify.Add(effect, resource, effect, "effectResource");
    manager.notify.Add(peer, resource, peer, "effectResource");
    effect.shader = {};
    texture._cachedEffect = effect.shader;
    texture.usedByCurrentEffect = parameter.usedByCurrentEffect = true;
    const resources = effect.resources, parameters = effect.parameters;
    effect.OnDestruct();
    effect.OnDestruct();
    assert.deepEqual(texture._materials, [peer]);
    assert.equal(effect.shader, null);
    assert.equal(texture._cachedEffect, null);
    assert.equal(texture.usedByCurrentEffect, false);
    assert.equal(parameter.usedByCurrentEffect, false);
    assert.equal(effect.effectResource, resource);
    assert.equal(effect.resources, resources);
    assert.equal(effect.parameters, parameters);
    assert.equal(resources.length, 1);
    assert.equal(parameters.length, 1);
    assert.deepEqual(manager.notify.GetByOwner(effect), []);
    assert.equal(manager.notify.GetByOwner(peer).length, 1);
    peer.OnDestruct();
  }
  finally { blue.resMan = previous; }
});

test("effect teardown releases minted adapters once even without an effect resource", () =>
{
  const effect = new Tr2Effect();
  const released = [];
  effect._ownedProviders.set({}, { kind: "texture", provider: { SetTexture(value) { released.push(["texture", value]); } } });
  effect._ownedProviders.set({}, { kind: "buffer", provider: { SetGpuBuffer(value) { released.push(["buffer", value]); } } });
  effect.OnDestruct();
  effect.OnDestruct();
  assert.deepEqual(released, [["texture", null], ["buffer", null]]);
  assert.equal(effect._ownedProviders.size, 0);
});
