import assert from "node:assert/strict";
import test from "node:test";
import { Tr2DeviceResource, TriDevice } from "../../npm/dist/trinity/index.js";
import { Tr2RenderContext_GetMainThreadRenderContext, Tr2SwapChain } from "../../npm/dist/trinity/core/index.js";
import { Tr2ReflectionProbe } from "../../npm/dist/trinity/core/Tr2ReflectionProbe.js";
import { Tr2RenderContextALStub } from "../../npm/dist/trinityal/index.js";

/** Installs the stub backend on the main-thread context, where Carbon's resources prepare. */
function mainContext(t)
{
  const context = Tr2RenderContext_GetMainThreadRenderContext(), previous = context.GetRenderContextAL();
  const al = new Tr2RenderContextALStub();
  al.CreateDevice({ mode: { width: 64, height: 64 } });
  context.SetRenderContextAL(al);
  t.after(() => context.SetRenderContextAL(previous));
  return context;
}

const registered = resource => TriDevice.GetResourcesRegistered().includes(resource);

test("Tr2SwapChain is infrastructure Tr2DeviceResource, created on the main context (Tr2SwapChain.h:16-17, cpp:13-48)", t =>
{
  mainContext(t);
  const chain = new Tr2SwapChain();
  assert.equal(chain.KeepAlive, Tr2DeviceResource.prototype.KeepAlive);
  assert.equal(registered(chain), false);

  chain.CreateForWindow(1);
  assert.equal(registered(chain), true, "creation is its first use");
  assert.equal(chain._neverPurge, true);

  chain.Destruct();
  assert.equal(registered(chain), false);
});

test("Tr2ReflectionProbe is a scene Tr2DeviceResource whose IsValid prepares (Tr2ReflectionProbe.h:15-17, cpp:63-66)", t =>
{
  mainContext(t);
  const probe = new Tr2ReflectionProbe();
  assert.equal(probe.KeepAlive, Tr2DeviceResource.prototype.KeepAlive);
  assert.equal(registered(probe), false);

  probe.IsValid();
  assert.equal(registered(probe), true, "IsValid is its use");
  assert.notEqual(probe._neverPurge, true, "scene content may expire");

  probe.Destruct();
  assert.equal(registered(probe), false);
});
