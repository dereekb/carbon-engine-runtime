import assert from "node:assert/strict";
import test from "node:test";
import { TriDevice } from "../../npm/dist/trinity/index.js";
import { Tr2RenderContext_GetMainThreadRenderContext } from "../../npm/dist/trinity/core/index.js";
import { Tr2RenderTarget } from "../../npm/dist/trinity/core/device/Tr2RenderTarget.js";
import { Tr2DepthStencil } from "../../npm/dist/trinity/core/device/Tr2DepthStencil.js";
import { TriRenderJob, TriStepPushDepthStencil, TriStepPushRenderTarget, TriStepSetDepthStencil, TriStepSetRenderTarget } from "../../npm/dist/trinity/renderJob/index.js";
import { Tr2RenderContextALStub } from "../../npm/dist/trinityal/index.js";
import { DepthStencilFormat, PixelFormat, TextureType } from "../../npm/dist/global/consts/renderContext/index.js";

// Carbon's four steps bind `*m_renderTarget` / `*m_depthStencil`, the target's own
// Tr2TextureAL (Tr2RenderTarget.h:95-102, Tr2DepthStencil.h:63-70). Using the
// target renews it; a target the idle sweep released fails the step rather than
// binding an empty texture.

const { RS_OK, RS_FAILED } = TriRenderJob.StepResult;

/** Installs the stub backend on the main-thread context, where targets prepare. */
function mainContext(t)
{
  const context = Tr2RenderContext_GetMainThreadRenderContext(), previous = context.GetRenderContextAL();
  const al = new Tr2RenderContextALStub();
  al.CreateDevice({ mode: { width: 64, height: 64 } });
  context.SetRenderContextAL(al);
  context.binds = 0;
  for (const verb of [ "SetRenderTarget", "SetDepthStencil" ])
  {
    const original = al[verb].bind(al);
    al[verb] = (...args) => { context.binds++; return original(...args); };
  }
  const activeTime = TriDevice.activeTime;
  t.after(() =>
  {
    TriDevice.activeTime = activeTime;
    context.SetRenderContextAL(previous);
  });
  return context;
}

/** A created render target, prepared as the device tick would. */
function renderTarget(t, context)
{
  const target = new Tr2RenderTarget();
  target.Create(32, 32, 1, PixelFormat.PIXEL_FORMAT_R8G8B8A8_UNORM, 1, 0, 0, TextureType.TEX_TYPE_2D, context);
  assert.equal(target.PrepareResources(), true);
  t.after(() => target.Destruct());
  return target;
}

/** A created depth-stencil, prepared as the device tick would. */
function depthStencil(t, context)
{
  const target = new Tr2DepthStencil();
  assert.equal(target.Create(32, 32, DepthStencilFormat.DSFMT_D24S8, 1, 0, 0, context), true);
  assert.equal(target.PrepareResources(), true);
  t.after(() => target.Destruct());
  return target;
}

/** Runs the idle sweep with the clock moved past the idle rule. */
function sweep()
{
  TriDevice.activeTime += (TriDevice.resourceIdleRule + 1) * 10000000;
  TriDevice.CollectResources();
}

test("TriStepSetRenderTarget binds the target's texture, renews it, and fails on a released target (cpp:25-32)", t =>
{
  const context = mainContext(t), target = renderTarget(t, context);
  const step = new TriStepSetRenderTarget();
  step.__init__(target);

  TriDevice.activeTime += 5;
  assert.equal(step.Execute(0, 0, context), RS_OK);
  assert.equal(context.GetRenderTarget(0).Equals(target.GetRenderTarget()), true, "the target's texture is bound");
  assert.equal(target._stamp, TriDevice.activeTime, "using the target renews it");

  sweep();
  assert.equal(target.GetRenderTarget(), null, "the sweep released the surface");
  const binds = context.binds;
  assert.equal(step.Execute(0, 0, context), RS_FAILED);
  assert.equal(context.binds, binds, "nothing was bound in its place");

  assert.equal(target.PrepareResources(), true);
  assert.equal(step.Execute(0, 0, context), RS_OK);
  assert.equal(context.GetRenderTarget(0).Equals(target.GetRenderTarget()), true, "the prepared surface binds again");
});

test("TriStepPushRenderTarget pushes the target's texture and fails before pushing a released target (cpp:13-24)", t =>
{
  const context = mainContext(t), target = renderTarget(t, context);
  const step = new TriStepPushRenderTarget();
  step.__init__(target, 0);
  const depth = context.GetStackSizeRT();

  TriDevice.activeTime += 5;
  assert.equal(step.Execute(0, 0, context), RS_OK);
  assert.equal(context.GetStackSizeRT(), depth + 1);
  assert.equal(context.GetRenderTarget(0).Equals(target.GetRenderTarget()), true, "the target's texture is bound");
  assert.equal(target._stamp, TriDevice.activeTime, "using the target renews it");
  context.PopRenderTarget();

  sweep();
  const binds = context.binds;
  assert.equal(step.Execute(0, 0, context), RS_FAILED);
  assert.equal(context.GetStackSizeRT(), depth, "a failed push leaves the stack alone");
  assert.equal(context.binds, binds, "nothing was bound in its place");
});

test("TriStepSetDepthStencil binds the surface's texture and fails on a released surface (cpp:18-26)", t =>
{
  const context = mainContext(t), target = depthStencil(t, context);
  const step = new TriStepSetDepthStencil();
  step.__init__(target);

  TriDevice.activeTime += 5;
  assert.equal(step.Execute(0, 0, context), RS_OK);
  assert.equal(context.GetDepthStencil().Equals(target.GetDepthStencil()), true, "the surface's texture is bound");
  assert.equal(target._stamp, TriDevice.activeTime, "using the surface renews it");

  sweep();
  assert.equal(target.GetDepthStencil(), null, "the sweep released the surface");
  const binds = context.binds;
  assert.equal(step.Execute(0, 0, context), RS_FAILED);
  assert.equal(context.binds, binds, "nothing was bound in its place");
});

test("TriStepPushDepthStencil pushes the surface's texture and fails before pushing a released surface (cpp:36-50)", t =>
{
  const context = mainContext(t), target = depthStencil(t, context);
  const step = new TriStepPushDepthStencil();
  step.__init__(target);
  const depth = context.GetStackSizeDS();

  TriDevice.activeTime += 5;
  assert.equal(step.Execute(0, 0, context), RS_OK);
  assert.equal(context.GetStackSizeDS(), depth + 1);
  assert.equal(context.GetDepthStencil().Equals(target.GetDepthStencil()), true, "the surface's texture is bound");
  assert.equal(target._stamp, TriDevice.activeTime, "using the surface renews it");
  context.PopDepthStencil();

  sweep();
  const binds = context.binds;
  assert.equal(step.Execute(0, 0, context), RS_FAILED);
  assert.equal(context.GetStackSizeDS(), depth, "a failed push leaves the stack alone");
  assert.equal(context.binds, binds, "nothing was bound in its place");
});
