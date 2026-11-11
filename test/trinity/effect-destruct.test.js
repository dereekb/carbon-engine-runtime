import assert from "node:assert/strict";
import test from "node:test";
import { blue, BlueResMan } from "../../npm/dist/blue/index.js";
import { Tr2Effect, Tr2EffectRes, TriTextureParameter, Tr2Vector4Parameter } from "../../npm/dist/trinity/shader/index.js";
import { Tr2EffectTechniqueInputs } from "../../npm/dist/trinity/shader/material/Tr2EffectTechniqueInputs.js";
import { Tr2EffectPassParameters } from "../../npm/dist/trinity/shader/material/Tr2EffectPassParameters.js";
import { Tr2EffectLibraryParameters } from "../../npm/dist/trinity/shader/material/Tr2EffectLibraryParameters.js";
import { Tr2RenderContext } from "../../npm/dist/trinity/core/index.js";

test("effect teardown detaches shared material resources and cached handles while preserving peer ownership", () =>
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
    let handleReleases = 0;
    const rebuild = texture.RebuildEffectHandles;
    texture.RebuildEffectHandles = function(value)
    {
      assert.equal(value, null);
      assert.equal(resources.includes(this), true, "cached handles retire before the resource list clears");
      handleReleases++;
      rebuild.call(this, value);
    };
    effect.Destruct();
    effect.Destruct();
    assert.equal(handleReleases, 1);
    texture.RebuildEffectHandles = rebuild;
    assert.deepEqual(texture._materials, [peer]);
    assert.equal(effect.shader, null);
    assert.equal(texture._cachedEffect, null);
    assert.equal(texture.usedByCurrentEffect, false);
    assert.equal(parameter.usedByCurrentEffect, false);
    // Existing Tr2Effect.Destruct (6f2915406:289-301) cleared these ownership slots.
    assert.equal(effect.effectResource, null);
    assert.equal(effect.resources, resources);
    assert.equal(effect.parameters, parameters);
    assert.equal(resources.length, 0);
    assert.equal(parameters.length, 1);
    assert.deepEqual(manager.notify.GetByOwner(effect), []);
    assert.equal(manager.notify.GetByOwner(peer).length, 1);
    peer.Destruct();
  }
  finally { blue.resMan = previous; }
});

test("effect teardown releases minted adapters once even without an effect resource", () =>
{
  const effect = new Tr2Effect();
  const released = [];
  const borrowed = new TriTextureParameter();
  borrowed.resource = { SetTexture() { assert.fail("borrowed provider must not be released"); } };
  effect.resources.Append(borrowed);
  effect._ownedProviders.set({}, { kind: "texture", provider: { SetTexture(value) { released.push(["texture", value]); } } });
  effect._ownedProviders.set({}, { kind: "buffer", provider: { SetGpuBuffer(value) { released.push(["buffer", value]); } } });
  effect.Destruct();
  effect.Destruct();
  assert.deepEqual(released, [["texture", null], ["buffer", null]]);
  assert.equal(effect._ownedProviders.size, 0);
});

test("public effect teardown releases pass and inherited library buffers once", () =>
{
  const context = new Tr2RenderContext();
  context.GetRenderContextAL().CreateDevice();
  const effect = new Tr2Effect();
  const passes = new Tr2EffectTechniqueInputs(), libraries = new Tr2EffectTechniqueInputs();
  const pass = new Tr2EffectPassParameters(), library = new Tr2EffectLibraryParameters();
  passes.passes.push(pass);
  libraries.libraries.push(library);
  effect.parametersForPasses.push(passes);
  effect.parametersForLibraries.push(libraries);
  const buffers = [pass.stageInput[0].constantBuffer, library.localInput.constantBuffer, library.globalInput.constantBuffer];
  let releases = 0;
  for (const buffer of buffers)
  {
    buffer.Create__Size(16, context);
    const destroy = buffer.Destroy;
    buffer.Destroy = function()
    {
      if (this.IsValid()) releases++;
      return destroy.call(this);
    };
  }
  effect.Destruct();
  effect.Destruct();
  assert.equal(releases, buffers.length);
  for (const buffer of buffers) assert.equal(buffer.IsValid(), false);
  assert.deepEqual(effect.parametersForPasses, []);
  assert.deepEqual(effect.parametersForLibraries, [libraries]);
});
