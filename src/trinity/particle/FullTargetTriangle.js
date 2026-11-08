// Not Carbon: the geometry Tr2GpuParticleSystemNoCompute draws for its update and
// emit passes, where Carbon dispatches compute shaders.
import { Topology } from "#consts/render-context";
import { Tr2EffectStateManager } from "../shader/Tr2EffectStateManager.js";

/** Draws one full-target triangle from the vertex index, for the update and emit passes. */
export class FullTargetTriangle
{
  static className = "FullTargetTriangle";

  /** @param {object} renderContext The Tr2RenderContext. */
  SubmitGeometry(renderContext)
  {
    renderContext.SetTopology(Topology.TOP_TRIANGLES);
    renderContext.GetEffectStateManager().ApplyVertexDeclaration(Tr2EffectStateManager.NullDeclaration);
    renderContext.DrawInstanced(3, 1, 0, 0);
  }
}
