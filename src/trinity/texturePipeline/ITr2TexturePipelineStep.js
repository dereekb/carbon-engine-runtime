// Source: trinity/trinity/Resources/TexturePipeline/ITr2TexturePipelineStep.h:17-22
import { CjsSchema, meta } from "#schema";
import { IRoot } from "../../blue/exposure/IRoot.js";

/** `ITr2TexturePipelineStep` - one step of a Tr2TexturePipeline. */
export class ITr2TexturePipelineStep extends IRoot
{
  /**
   * `GetResourceDependencies` - adds the resources this step reads. Carbon's default adds none.
   *
   * @adapted a C++ output reference becomes the return value
   * @param {Set<string>} [resources] Caller-owned; allocated when omitted.
   * @returns {Set<string>} The set.
   */
  GetResourceDependencies(resources = new Set())
  {
    return resources;
  }

  /**
   * `Execute` - runs the step on the shared bitmap.
   *
   * @abstract
   * @param {object} bitmap The bitmap the steps share.
   * @param {Map<string, object>} inputs Input bitmaps.
   * @param {object} params The pipeline's parameters.
   * @returns {boolean} Whether the step succeeded.
   */
  Execute(bitmap, inputs, params)
  {
  }
}

CjsSchema.decorateMethod(ITr2TexturePipelineStep, "Execute", meta.abstract);
CjsSchema.exposure.interface("ITr2TexturePipelineStep")(ITr2TexturePipelineStep);
