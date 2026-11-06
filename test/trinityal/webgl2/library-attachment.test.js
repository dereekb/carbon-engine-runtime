import assert from "node:assert/strict";
import test from "node:test";
import { CjsLibrary } from "../../../npm/dist/core/index.js";
import { BlueOS, BluePaths, BlueResMan } from "../../../npm/dist/blue/index.js";
import { CjsWebglFormat } from "../../../npm/dist/resource/formats/webgl/index.js";
import { Tr2EffectRes } from "../../../npm/dist/trinity/shader/Tr2EffectRes.js";
import { trinity } from "../../../npm/dist/trinity/index.js";
import { Tr2RenderContext_GetMainThreadRenderContext } from "../../../npm/dist/trinity/core/context/Tr2RenderContext.js";
import { GetEffectPathDefaults } from "../../../npm/dist/global/utils/effectPath.js";
import { Tr2RenderContextALWebgl2 } from "../../../npm/dist/trinityal/webgl2/index.js";
import { ALResult, Tr2TextureAL, Tr2BitmapDimensions } from "../../../npm/dist/trinityal/index.js";
import { PixelFormat, Tr2GpuUsage } from "../../../npm/dist/global/consts/renderContext/index.js";
import { FakeWebgl2 } from "./fakeWebgl2.js";

test("an explicitly selected WebGL2 AL attaches with its GLSL policy and survives resize", async () =>
{
    const { gl, calls } = FakeWebgl2();
    const al = new Tr2RenderContextALWebgl2({ gl });
    const library = new CjsLibrary({
        effects: { source: "dx11", target: "webgl", translator: CjsWebglFormat, shaderModel: "depth" },
        callbackMan: { useWorkers: false }
    });
    let depth = new Tr2TextureAL();
    try
    {
        assert.equal(al.CreateDevice({ mode: { width: 64, height: 32 } }), ALResult.S_OK);
        assert.equal(Tr2EffectRes.GetBackend(), null, "construction does not commit effects");
        await library.Initialize({ resMan: new BlueResMan(), paths: new BluePaths(), os: new BlueOS(), sof: null, characterLibrary: null });
        const device = library.AttachTrinity({ renderContextAL: al });
        assert.equal(trinity.device, device);
        assert.equal(Tr2RenderContext_GetMainThreadRenderContext().GetRenderContextAL(), al);
        assert.deepEqual(Tr2EffectRes.GetBackend(), {
            source: "dx11", target: "webgl", translator: CjsWebglFormat, permutations: "onDemand"
        });
        assert.deepEqual(GetEffectPathDefaults(), { platformName: "dx11", shaderModel: "depth" });

        for (const [width, height] of [[64, 32], [96, 48]])
        {
            depth.Destroy();
            assert.equal(al.SetPresentParameters({ mode: { width, height } }), ALResult.S_OK);
            depth = new Tr2TextureAL();
            assert.equal(depth.Create__GpuUsage(
                Tr2BitmapDimensions.create__WidthHeightMipCountFormat(width, height, 1, PixelFormat.PIXEL_FORMAT_D32_FLOAT),
                Tr2GpuUsage.DEPTH_STENCIL, al), ALResult.S_OK);
            assert.equal(al.SetDepthStencil(depth), ALResult.S_OK);
            assert.equal(al.Clear({ color: 0xff102030, depth: 1 }), ALResult.S_OK);
            assert.equal(al.EndScene(), ALResult.S_OK);
            assert.equal(al.Present(), ALResult.S_OK);
            assert.deepEqual([gl.canvas.width, gl.canvas.height], [width, height]);
            assert.deepEqual(al.GetViewport(), { x: 0, y: 0, width, height, minZ: 0, maxZ: 1 });
        }
        assert.equal(calls.filter(([name]) => name === "blitFramebuffer").length, 2);
        assert.throws(() => library.AttachTrinity({ renderContextAL: al }), /already initialized/);
    }
    finally
    {
        await library.Shutdown();
        depth.Destroy();
        al.Destroy();
    }
    assert.equal(trinity.device, null);
    assert.equal(al.IsValid(), false);
});
