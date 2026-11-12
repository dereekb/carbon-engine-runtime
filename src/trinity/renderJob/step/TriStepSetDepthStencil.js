// Source: trinity/trinity/RenderJob/TriStepSetDepthStencil.h
// Source: trinity/trinity/RenderJob/TriStepSetDepthStencil.cpp
import { exposure as be } from "#be";
import { type } from "#schema";
import { TriRenderJob } from "../TriRenderJob.js";
import { TriRenderStep } from "./TriRenderStep.js";


/**
 * Step that binds a depth-stencil directly, without touching the depth-stencil
 * stack.
 */
@be.define("TriStepSetDepthStencil")
@be.mapInterface(TriRenderStep)
@be.exposureChainTo(TriRenderStep)
export class TriStepSetDepthStencil extends TriRenderStep
{
  @be.mapAttribute(be.READWRITE)
  @type.object.ref.weak("Tr2DepthStencil")
  depthStencil = null;

  /**
   * Stores the depth-stencil to bind.
   *
   * @adapted
   */
  @be.mapMethodAndWrapOptionalArgs(1)
  __init__(depthStencil = null)
  {
    this.depthStencil = depthStencil ?? null;
  }

  /**
   * Binds the depth-stencil's texture, Carbon's `*m_depthStencil` conversion
   * (TriStepSetDepthStencil.cpp:18-26, Tr2DepthStencil.h:63-70), or an empty
   * texture to unbind when none is set; a refused bind is RS_FAILED.
   *
   * @adapted Using the surface renews it (IsGood); a set surface that is not prepared (or was released by the idle sweep) fails the step instead of binding empty, so the job draws nothing.
   */

  Execute(_realTime, _simTime, renderContext)
  {
    let texture = null;
    if (this.depthStencil)
    {
      texture = this.depthStencil.IsGood() ? this.depthStencil.GetDepthStencil() : null;
      if (!texture) return TriRenderJob.StepResult.RS_FAILED;
    }
    return renderContext.GetEffectStateManager().SetDepthStencilBuffer(texture) ? TriRenderJob.StepResult.RS_OK : TriRenderJob.StepResult.RS_FAILED;
  }
}
