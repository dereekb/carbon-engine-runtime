// Source: trinity/trinity/RenderJob/TriStepSetView.h
// Source: trinity/trinity/RenderJob/TriStepSetView.cpp
import { exposure as be } from "#be";
import { type } from "#schema";
import { TriRenderJob } from "../TriRenderJob.js";
import { Tr2Renderer } from "../../core/Tr2Renderer.js";
import { TriRenderStep } from "./TriRenderStep.js";
import { mat4 } from "#math/mat4";


/**
 * Step that installs the view transform for the steps that follow, taken either
 * from an authored view or from a camera updated against the current viewport.
 */
@be.define({
  name: "TriStepSetView",
  // TriStepSetView_Blue.cpp:12-27, in Carbon's order.
  interfaces: [ TriRenderStep ],
  members: [
    [ be.ATTR, "view", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "camera", be.READWRITE | be.PERSIST ],
    [ be.METHOD, "__init__", be.WRAP_OPTIONAL_ARGS, "SetViewCameraParent" ]
  ],
  chainTo: TriRenderStep
})
export class TriStepSetView extends TriRenderStep
{
  @type.object.ref("TriView")
  view = null;

  @type.object.ref("EveCamera")
  camera = null;

  /**
   * Stores the view and camera the step chooses between at execution time.
   *
   * @adapted
   */
  __init__(view = null, camera = null)
  {
    this.SetViewCameraParent(view, camera);
  }

  /**
   * Replaces both operands; either may be null, and the view takes precedence
   * when both are set.
   *
   * @adapted
   */
  SetViewCameraParent(view, camera)
  {
    this.view = view ?? null;
    this.camera = camera ?? null;
  }

  /**
   * Sets the renderer's view transform from the view when one is authored;
   * otherwise updates the camera using the render context viewport's aspect
   * ratio (1 when the viewport is missing or has no height) and sets the
   * resulting view matrix (TriStepSetView.cpp:21-33).
   *
   * @implemented
   */

  Execute(realTime, simTime, renderContext)
  {
    if (this.view)
    {
      Tr2Renderer.SetViewTransform(this.view.GetTransform(mat4.create()));
    }
    else if (this.camera)
    {
      const viewport = renderContext.GetViewport();
      const aspectRatio = viewport?.height ? viewport.width / viewport.height : 1;
      this.camera.Update(simTime, aspectRatio, realTime);
      Tr2Renderer.SetViewTransform(this.camera.GetViewMatrix());
    }
    return TriRenderJob.StepResult.RS_OK;
  }
}
