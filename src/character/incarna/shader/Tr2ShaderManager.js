// Incarna: reconstructed from Black records. Retired from Carbon: its donor is at trinity a198e5da~1, Shader/, not yet compared. See ../README.md.
import { exposure as be } from "#be";
import { IRoot } from "#exposure/IRoot";
import { meta, type } from "#schema";

/**
 * Incarna's shader library: every high-level shader an Incarna material can
 * name.
 *
 * Current Carbon declares no such class. Its one member is that of build
 * 1142708's `res:/graphics/shaders/shaderdescriptions.black`, whose
 * `shaderLibrary` holds the 75 Tr2HighLevelShaders, one per compiled
 * `graphics/shaders/compiled/<platform>/*.fxt`. The exposure flags are guessed;
 * the record shows only that the member persists.
 *
 * Data only.
 *
 * @adapted
 */
@meta.define("Tr2ShaderManager")
@meta.exposureChainTo(IRoot)
export class Tr2ShaderManager extends IRoot
{

  /** Every high-level shader, in file order. Flags guessed. */
  @be.mapAttribute(be.READ | be.PERSIST)
  @type.list("Tr2HighLevelShader")
  shaderLibrary = [];

}
