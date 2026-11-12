// Source: trinity/trinity/RenderJob/TriStepPushRenderTarget.h
// Source: trinity/trinity/RenderJob/TriStepPushRenderTarget.cpp
import { exposure as be } from "#be";
import { type } from "#schema";
import { TriRenderStep } from "./TriRenderStep.js";
import { TriRenderJob } from "../TriRenderJob.js";


/** Step that pushes a render target onto the render context's stack for a given slot. */
@be.define("TriStepPushRenderTarget")
@be.mapInterface(TriRenderStep)
@be.exposureChainTo(TriRenderStep)
export class TriStepPushRenderTarget extends TriRenderStep
{
  @be.mapAttribute(be.READWRITE)
  @type.uint32
  slot = 0;

  @be.mapAttribute(be.READWRITE)
  @type.object.ref.weak("Tr2RenderTarget")
  renderTarget = null;

  /**
   * Stores the render target and the slot it is pushed for.
   *
   * @adapted
   */
  @be.mapMethodAndWrapOptionalArgs(2)
  __init__(renderTarget = null, slot = 0)
  {
    this.renderTarget = renderTarget ?? null;
    this.slot = Number(slot) >>> 0;
  }

  /**
   * Pushes the target's texture for its slot, Carbon's `*m_renderTarget`
   * conversion (TriStepPushRenderTarget.cpp:13-24, Tr2RenderTarget.h:95-102);
   * every push needs a matching TriStepPopRenderTarget in the same job or the
   * job's stack guard unwinds it.
   *
   * @adapted Using the target renews it (IsGood); a target without a surface (not yet prepared, or released by the idle sweep) fails the step before pushing, instead of binding empty, so the job draws nothing.
   */

  Execute(_realTime, _simTime, renderContext)
  {
    // CARBON BRANCHES BETWEEN TWO OVERLOADS HERE (`cpp:13-24`), and the
    // difference is not cosmetic: with a target it binds one, without it calls
    // the slot-only form that saves the slot and binds NOTHING. Passing a null
    // target through would instead bind an empty texture and clear the slot,
    // which is a third thing - the one Tr2ShadowMap actually wants.
    const esm = renderContext.GetEffectStateManager();

    if (this.renderTarget)
    {
      const texture = this.renderTarget.IsGood() ? this.renderTarget.GetRenderTarget() : null;
      if (!texture) return TriRenderJob.StepResult.RS_FAILED;
      esm.PushRenderTarget__TextureAL(texture, this.slot);
    }
    else esm.PushRenderTarget__Current(this.slot);
    return TriRenderJob.StepResult.RS_OK;
  }
}
