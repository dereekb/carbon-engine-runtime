// Source: trinity/trinity/RenderJob/TriStepSetViewport.h
// Source: trinity/trinity/RenderJob/TriStepSetViewport.cpp
import { exposure as be } from "#be";
import { type } from "#schema";
import { TriRenderJob } from "../TriRenderJob.js";
import { TriRenderStep } from "./TriRenderStep.js";


/**
 * Step that installs a viewport, or restores the full-screen viewport when none
 * is authored.
 */
@be.define({
  name: "TriStepSetViewport",
  // TriStepSetViewport_Blue.cpp:12-26, in Carbon's order.
  interfaces: [ TriRenderStep ],
  members: [
    [ be.ATTR, "viewport", be.READWRITE | be.PERSIST ],
    [ be.METHOD, "__init__", be.WRAP_OPTIONAL_ARGS, "SetViewport" ]
  ],
  chainTo: TriRenderStep
})
export class TriStepSetViewport extends TriRenderStep
{
  @type.object.ref("TriViewport")
  viewport = null;

  /**
   * Stores the viewport this step installs.
   *
   * @adapted
   */
  __init__(viewport = null)
  {
    this.SetViewport(viewport);
  }

  /**
   * Replaces the viewport; null selects the full-screen viewport instead of
   * leaving the current one.
   *
   * @adapted
   */
  SetViewport(viewport)
  {
    this.viewport = viewport ?? null;
  }

  /**
   * Sets the authored viewport, or asks the render context for its full-screen
   * viewport when none is set.
   *
   * @implemented
   */

  Execute(_realTime, _simTime, renderContext)
  {
    // Through the effect state manager, as Carbon's step does
    // (`TriStepSetViewport.cpp:25,29` call `renderContext.m_esm`). The context's
    // own SetViewport is the abstraction layer's and takes an already-clipped
    // device viewport; the manager owns the authored one and derives it.
    const states = renderContext.GetEffectStateManager();

    if (this.viewport) states.SetViewport(this.viewport);
    else renderContext.SetFullScreenViewport();
    return TriRenderJob.StepResult.RS_OK;
  }
}
