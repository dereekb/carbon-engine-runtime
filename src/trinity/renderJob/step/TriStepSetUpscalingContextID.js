// Source: trinity/trinity/RenderJob/TriStepSetUpscalingContextID.h
import { exposure as be } from "#be";
// Hand-maintained from Carbon source, promoted out of generated intake.
import { type } from "#schema";
import { TriRenderStep } from "./TriRenderStep.js";

/**
 * A render step that selects which upscaling context subsequent work resolves against.
 * @adapted No destructor hook: Carbon's RenderJob/TriStepSetUpscalingContextID.cpp:13-16 resets the renderer's global context ID; the JS context setter is a no-op and acquires no state. Upscaling context selection remains unported.
 */
@be.define("TriStepSetUpscalingContextID")
@be.mapInterface(TriRenderStep)
@be.exposureChainTo(TriRenderStep)
export class TriStepSetUpscalingContextID extends TriRenderStep
{

  /** m_upscalingContextID (uint32_t) [READ] */
  @be.mapAttribute(be.READ)
  @type.uint32
  upscalingContextID = 0xffffffff;

  /**
   * Carbon method __init__ -> py__init__ (MAP_METHOD_AND_WRAP_OPTIONAL_ARGS).
   *
   * @implemented
   */
  @be.mapMethodAndWrapOptionalArgs(1)
  __init__(upscalingContextID = 0xffffffff)
  {
    this.upscalingContextID = Number(upscalingContextID) >>> 0;
  }

  /**
   * Selects the upscaling context subsequent steps resolve against.
   *
   * @adapted
   */

  Execute(_realTime, _simTime, renderContext)
  {
    renderContext.SetUpscalingContextID(this.upscalingContextID);
    return TriRenderStep.Result.RS_OK;
  }

}
