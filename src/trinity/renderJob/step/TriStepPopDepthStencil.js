import { exposure as be } from "#be";
// Source: trinity/trinity/RenderJob/TriStepPopDepthStencil.h
// Source: trinity/trinity/RenderJob/TriStepPopDepthStencil.cpp
import { blue } from "#schema";
import { TriRenderStep } from "./TriRenderStep.js";
import { TriRenderJob } from "../TriRenderJob.js";


/** Step that pops the render context's depth-stencil stack, undoing an earlier push. */
@be.define({
  name: "TriStepPopDepthStencil",
  // TriStepPopDepthStencil_Blue.cpp:12-17, in Carbon's order.
  interfaces: [ TriRenderStep ],
  members: [],
  chainTo: TriRenderStep
})
export class TriStepPopDepthStencil extends TriRenderStep
{
  /**
   * Pops the depth-stencil pushed earlier in the job; popping more than was
   * pushed trips the job's stack guard.
   *
   * @implemented
   */

  Execute(_realTime, _simTime, renderContext)
  {
    renderContext.GetEffectStateManager().PopDepthStencilBuffer();
    return TriRenderJob.StepResult.RS_OK;
  }
}
