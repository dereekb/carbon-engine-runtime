// Source: trinity/trinity/RenderJob/TriStepPushViewTransform.h
// Source: trinity/trinity/RenderJob/TriStepPushViewTransform.cpp
import { exposure as be } from "#be";
import { TriRenderStep } from "./TriRenderStep.js";
import { TriRenderJob } from "../TriRenderJob.js";
import { Tr2Renderer } from "../../core/Tr2Renderer.js";

// Carbon: RenderJob/TriStepPushViewTransform.cpp — Execute pushes the current
// view transform (Tr2Renderer::PushViewTransform).

/** Step that saves the current view transform so a later pop can restore it. */
@be.define({
  name: "TriStepPushViewTransform",
  // TriStepPushViewTransform_Blue.cpp:11-16, in Carbon's order.
  interfaces: [ TriRenderStep ],
  members: [],
  chainTo: TriRenderStep
})
export class TriStepPushViewTransform extends TriRenderStep
{
  /**
   * Pushes the render context's current view transform; the value is not supplied by
   * the step, only the intent to save it.
   *
   * @implemented
   */

  Execute(_realTime, _simTime, _renderContext)
  {
    // TriStepPushViewTransform.cpp:9.
    Tr2Renderer.PushViewTransform();
    return TriRenderJob.StepResult.RS_OK;
  }
}
