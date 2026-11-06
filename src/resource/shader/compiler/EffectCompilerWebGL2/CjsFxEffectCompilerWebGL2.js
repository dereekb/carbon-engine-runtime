// Not in Carbon: the WebGL2 target, the driver's PLATFORM_WEBGL2. It is the
// WebGPU target (CjsFxEffectCompilerWebGPU.js) with another printer and another
// pass block: the passes over the tree, the HLSL packing and the stage data are
// one implementation, so one `.fx` means the same on both.
//
// The output is what the WebGL2 AL reads from a translated effect: GLSL ES 3.00
// text in each stage and `glslBackendBlock.js`'s block on each pass. WebGL2 has
// no compute stage, so a compute pass is refused here, not at draw time.

import { writeGlslBackendBlock } from "../../../formats/webgl/core/glslBackendBlock.js";
import { CjsFxEffectCompilerWebGPU } from "../EffectCompilerWebGPU/CjsFxEffectCompilerWebGPU.js";
import { CjsFxOutputGLSL } from "./CjsFxOutputGLSL.js";

/** The backend block's stage name, by the compiler's stage kind. */
const BLOCK_STAGE = { vertex: "vertex", fragment: "pixel" };

/**
 * The WebGL2 target: compiles one permutation of an effect into `EffectData`,
 * each stage's program being GLSL ES 3.00, each pass carrying its GLSL block.
 *
 * Modelled on: EffectCompilerMetal (trinity/shadercompiler/EffectCompilerMetal.h:75)
 */
export class CjsFxEffectCompilerWebGL2 extends CjsFxEffectCompilerWebGPU
{
    /** Stable name independent of minification; no registry is required. */
    static className = "CjsFxEffectCompilerWebGL2";

    /**
     * What a pass's stages accumulate while they print.
     *
     * @returns {{ stages: Object<string, object> }} Each stage's block record, by block stage name.
     */
    _CreatePassData()
    {
        return { stages: {} };
    }

    /**
     * The pass's GLSL backend block.
     *
     * @param {{ stages: Object<string, object> }} passData From `_CreatePassData`, after the stages.
     * @returns {Uint8Array} The block.
     */
    _WritePassBlock(passData)
    {
        return writeGlslBackendBlock({ stages: passData.stages, transforms: [] });
    }

    /**
     * One stage's GLSL.
     *
     * @param {import("../ParserState/ParserState.js").ParserState} state The parse, with this stage's symbols marked used.
     * @param {import("../EffectData/StageInput.js").StageInput} stage The stage.
     * @param {"vertex"|"fragment"|"compute"} kind Its kind.
     * @param {import("../ASTNode/ASTNode.js").ASTNode} entry PatchShader's wrapper.
     * @param {Set<object>} globalsStructs The struct symbols laid out over used members.
     * @param {{ stages: Object<string, object> }} passData From `_CreatePassData`.
     * @returns {string} The program.
     */
    _PrintStage(state, stage, kind, entry, globalsStructs, passData)
    {
        if (kind === "compute")
        {
            throw new Error("CjsFxEffectCompilerWebGL2: WebGL2 has no compute stage");
        }
        const printer = new CjsFxOutputGLSL({ state, stage: kind, entry, globalsStructs, pipelineInputs: stage.pipelineInputs });
        const text = printer.Write();
        passData.stages[BLOCK_STAGE[kind]] = printer.GetBlockStage();
        return text;
    }
}
