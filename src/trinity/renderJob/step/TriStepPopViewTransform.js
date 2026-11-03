// Source: trinity/trinity/RenderJob/TriStepPopViewTransform.h
// Source: trinity/trinity/RenderJob/TriStepPopViewTransform.cpp
import { exposure as be } from "#be";
import { TriRenderStep } from "./TriRenderStep.js";
import { TriRenderJob } from "../TriRenderJob.js";
import { Tr2Renderer } from "../../core/Tr2Renderer.js";

// Carbon: RenderJob/TriStepPopViewTransform.cpp — Execute pops the view
// transform (Tr2Renderer::PopViewTransform).

/**
 * Step that pops the render context's view-transform stack, restoring the view saved
 * by an earlier push.
 */
@be.define({
  name: "TriStepPopViewTransform",
  // TriStepPopViewTransform_Blue.cpp:11-16, in Carbon's order.
  interfaces: [ TriRenderStep ],
  members: [],
  chainTo: TriRenderStep
})
export class TriStepPopViewTransform extends TriRenderStep
{
  /**
   * Restores the view transform saved by the matching push step.
   *
   * @implemented
   */

  Execute(_realTime, _simTime, _renderContext)
  {
    // TriStepPopViewTransform.cpp:9.
    Tr2Renderer.PopViewTransform();
    return TriRenderJob.StepResult.RS_OK;
  }
}
