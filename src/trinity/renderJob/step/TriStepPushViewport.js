// Source: trinity/trinity/RenderJob/TriStepPushViewport.h
// Source: trinity/trinity/RenderJob/TriStepPushViewport.cpp
import { exposure as be } from "#be";
import { TriRenderStep } from "./TriRenderStep.js";
import { TriRenderJob } from "../TriRenderJob.js";

// Carbon: RenderJob/TriStepPushViewport.cpp — Execute pushes the current
// viewport onto the render context's ESM stack.

/** Step that saves the current viewport so a later pop can restore it. */
@be.define({
  name: "TriStepPushViewport",
  // TriStepPushViewport_Blue.cpp:11-16, in Carbon's order.
  interfaces: [ TriRenderStep ],
  members: [],
  chainTo: TriRenderStep
})
export class TriStepPushViewport extends TriRenderStep
{
  /**
   * Pushes the render context's current viewport; the value is not supplied by the
   * step, only the intent to save it.
   *
   * @implemented
   */

  Execute(_realTime, _simTime, renderContext)
  {
    // The manager owns the viewport save stack (`TriStepPushViewport.cpp:9`).
    renderContext.GetEffectStateManager().PushViewport();
    return TriRenderJob.StepResult.RS_OK;
  }
}
