// Composes an EveSpaceSceneRenderDriver with the batch lists a space scene
// draws. The driver takes its batch manager from its caller
// (EveSpaceSceneRenderDriver.SetBatchManager); this is that caller, lifted from
// Graphene, which composed it twice (viewport/runtime/demo/demo.js and
// webgl2/realContent.js). Carbon's equivalent is the scene's own lists and the
// quad collector it gathers from (EveSpaceScene.cpp:224-228, :1509-1520).
import { RenderingMode, TriBatchType } from "../../global/consts/graphics/trinityEnums.js";
import { CjsBatchManager } from "../../trinity/core/batch/CjsBatchManager.js";
import { TriRenderBatchAccumulator } from "../../trinity/core/batch/TriRenderBatch/TriRenderBatchAccumulator.js";
import { Tr2QuadRenderer } from "../../trinity/core/Tr2QuadRenderer/Tr2QuadRenderer.js";
import { Tr2RenderContext_GetMainThreadRenderContext } from "../../trinity/core/context/Tr2RenderContext.js";
import { EveSpaceSceneRenderDriver } from "../../trinity/eve/scene/EveSpaceSceneRenderDriver.js";

/**
 * The scene's batch lists (EveSpaceScene.cpp:224-228) and the rendering mode
 * the driver applies to each (RenderTransparentBatches, cpp:1170-1173;
 * RenderDistortionBatches draws under RM_ALPHA_ADDITIVE, cpp:1248).
 */
const BATCH_MODES = new Map([
  [ TriBatchType.TRIBATCHTYPE_OPAQUE, RenderingMode.RM_OPAQUE ],
  [ TriBatchType.TRIBATCHTYPE_DECAL, RenderingMode.RM_DECAL ],
  [ TriBatchType.TRIBATCHTYPE_TRANSPARENT, RenderingMode.RM_ALPHA ],
  [ TriBatchType.TRIBATCHTYPE_ADDITIVE, RenderingMode.RM_ALPHA_ADDITIVE ],
  [ TriBatchType.TRIBATCHTYPE_DISTORTION, RenderingMode.RM_ALPHA_ADDITIVE ]
]);

/**
 * An accumulator stamped with its list's rendering mode. `Commit` stamps the
 * mode onto every batch and `Clear` resets it to RM_ANY each frame, so it is
 * restored after every clear; Carbon sets it per list on the scene
 * (Tr2InteriorScene.cpp:1120).
 *
 * @param {number} batchType The list's TriBatchType.
 * @returns {TriRenderBatchAccumulator} The accumulator.
 */
function CreateAccumulator(batchType)
{
  const accumulator = new TriRenderBatchAccumulator();
  const mode = BATCH_MODES.get(batchType);
  const clear = accumulator.Clear.bind(accumulator);

  accumulator.Clear = (...rest) =>
  {
    const out = clear(...rest);
    accumulator.renderingMode = mode;
    return out;
  };
  accumulator.renderingMode = mode;
  return accumulator;
}

/**
 * Creates a driver that collects a space scene's batches, including the quad
 * step of GatherBatches (EveSpaceScene.cpp:1512-1514): after the renderables,
 * the scene's objects add their sprite and spotlight quads and the quad
 * renderer's batches join the opaque and additive lists.
 *
 * @returns {EveSpaceSceneRenderDriver} The driver, with no scene or camera yet.
 */
export function createSpaceSceneDriver()
{
  const driver = new EveSpaceSceneRenderDriver();
  const batchManager = new CjsBatchManager({ batchTypes: Array.from(BATCH_MODES.keys()), createAccumulator: CreateAccumulator });

  batchManager.RegisterCollector("Tr2QuadRenderer", {
    Collect(_renderables, batchMap)
    {
      const scene = driver.scene;
      if (!scene) return;

      scene.UpdateQuadRenderer(scene.updateContext.GetFrustum(), scene.objects, Tr2RenderContext_GetMainThreadRenderContext());
      const quads = Tr2QuadRenderer.Instance();
      quads.GetBatches(TriBatchType.TRIBATCHTYPE_OPAQUE, batchMap.GetAccumulator(TriBatchType.TRIBATCHTYPE_OPAQUE));
      quads.GetBatches(TriBatchType.TRIBATCHTYPE_ADDITIVE, batchMap.GetAccumulator(TriBatchType.TRIBATCHTYPE_ADDITIVE));
    }
  });
  batchManager.Initialize();
  return driver.SetBatchManager(batchManager);
}
