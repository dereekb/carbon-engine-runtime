// Source: trinity/trinity/RenderJob/TriStepSetRenderTarget.h
// Source: trinity/trinity/RenderJob/TriStepSetRenderTarget.cpp
import { exposure as be } from "#be";
import { type } from "#schema";
import { TriRenderJob } from "../TriRenderJob.js";
import { TriRenderStep } from "./TriRenderStep.js";


/**
 * Step that binds a render target to slot 0 directly, without touching the
 * render-target stack.
 */
@be.define("TriStepSetRenderTarget")
@be.mapInterface(TriRenderStep)
@be.exposureChainTo(TriRenderStep)
export class TriStepSetRenderTarget extends TriRenderStep
{
  @be.mapAttribute(be.READWRITE | be.PERSIST)

  @type.object.ref("Tr2RenderTarget")
  renderTarget = null;

  /**
   * Stores the render target to bind.
   *
   * @adapted
   */
  @be.mapMethodAndWrapOptionalArgs(1)
  __init__(renderTarget = null)
  {
    this.renderTarget = renderTarget ?? null;
  }

  /**
   * Binds the target's texture to slot 0, Carbon's `*m_renderTarget` conversion
   * (TriStepSetRenderTarget.cpp:25-32, Tr2RenderTarget.h:95-102); with none set
   * the current binding is left alone rather than cleared.
   *
   * @adapted Using the target renews it (IsGood); a target without a surface (not yet prepared, or released by the idle sweep) fails the step instead of binding empty, so the job draws nothing.
   */

  Execute(_realTime, _simTime, renderContext)
  {
    if (this.renderTarget)
    {
      const texture = this.renderTarget.IsGood() ? this.renderTarget.GetRenderTarget() : null;
      if (!texture) return TriRenderJob.StepResult.RS_FAILED;
      renderContext.GetEffectStateManager().SetRenderTarget(0, texture);
    }
    return TriRenderJob.StepResult.RS_OK;
  }
}
