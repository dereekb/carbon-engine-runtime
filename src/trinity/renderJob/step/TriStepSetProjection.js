// Source: trinity/trinity/RenderJob/TriStepSetProjection.h
// Source: trinity/trinity/RenderJob/TriStepSetProjection.cpp
import { exposure as be } from "#be";
import { type } from "#schema";
import { TriRenderJob } from "../TriRenderJob.js";
import { TriRenderStep } from "./TriRenderStep.js";


/** Step that installs an authored projection for the steps that follow. */
@be.define({
  name: "TriStepSetProjection",
  // TriStepSetProjection_Blue.cpp:11-25, in Carbon's order.
  interfaces: [ TriRenderStep ],
  members: [
    [ be.ATTR, "projection", be.READWRITE | be.PERSIST ],
    [ be.METHOD, "__init__", be.WRAP_OPTIONAL_ARGS, 1, "SetProjection" ]
  ],
  chainTo: TriRenderStep
})
export class TriStepSetProjection extends TriRenderStep
{
  @type.object.ref("TriProjection")
  projection = null;

  /**
   * Stores the projection this step installs.
   *
   * @adapted
   */
  __init__(projection = null)
  {
    this.SetProjection(projection);
  }

  /**
   * Replaces the projection; null makes the step a no-op rather than clearing
   * the current projection.
   *
   * @adapted
   */
  SetProjection(projection)
  {
    this.projection = projection ?? null;
  }

  /**
   * Sets the authored projection on the renderer, leaving the current
   * projection untouched when there is none (TriStepSetProjection.cpp:20-27).
   *
   * @implemented
   */

  Execute(_realTime, _simTime, renderContext)
  {
    if (this.projection)
    {
      this.projection.SetProjection__RenderContext(renderContext);
    }
    return TriRenderJob.StepResult.RS_OK;
  }
}
