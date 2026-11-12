// Source: trinity/trinity/RenderJob/TriStepGenerateMipMaps.h
// Source: trinity/trinity/RenderJob/TriStepGenerateMipMaps.cpp
import { exposure as be } from "#be";
import { type } from "#schema";
import { TriRenderJob } from "../TriRenderJob.js";
import { TriRenderStep } from "./TriRenderStep.js";


/** Step that requests regeneration of a render target's mip chain. */
@be.define("TriStepGenerateMipMaps")
@be.mapInterface(TriRenderStep)
@be.exposureChainTo(TriRenderStep)
export class TriStepGenerateMipMaps extends TriRenderStep
{
  @be.mapAttribute(be.READWRITE | be.PERSIST)

  @type.object.ref("Tr2RenderTarget")
  renderTarget = null;

  /**
   * Stores the render target whose mip chain is regenerated.
   *
   * @adapted
   */
  @be.mapMethodAndWrapOptionalArgs(1)
  __init__(renderTarget = null)
  {
    this.renderTarget = renderTarget ?? null;
  }

  /**
   * Carbon Execute (TriStepGenerateMipMaps.cpp:15-22): regenerate the render
   * target texture's mip chain; with no target set the step is a no-op.
   *
   * @implemented
   */

  Execute(_realTime, _simTime, renderContext)
  {
    // A released target has no surface until the device tick prepares it; there is nothing to generate from.
    const surface = this.renderTarget ? this.renderTarget.GetRenderTarget() : null;
    if (surface) surface.GenerateMipMaps(renderContext);
    return TriRenderJob.StepResult.RS_OK;
  }
}
