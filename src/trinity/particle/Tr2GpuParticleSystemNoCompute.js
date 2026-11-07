// Not Carbon: Tr2GpuParticleSystem's state and passes on a backend with no compute.
// Carbon's system is compute shaders over storage buffers, atomics and indirect
// draws, and WebGL2 has none of them, so this runs the same simulation as draws
// over textures. The system keeps everything else: its emitters, its emit requests,
// its params mirror and its clocks. Design: docs internal/decisions/
// trinity-abstraction-layer.md, GPU particle pass design.
import { vec4 } from "#math/vec4";
import { PixelFormat, ShaderType, TextureType, Topology, Tr2CpuUsage, Tr2GpuUsage } from "#consts/render-context";
import { BitmapDimensions as Tr2BitmapDimensions } from "#imageio";
import { Failed, Tr2ConstantBufferAL, Tr2TextureSubresource } from "#trinityal";
import * as CcpLog from "../../global/logging/ccpLog.js";
import { Tr2MsaaDesc } from "../../trinityal/Tr2HalHelperStructures/Tr2MsaaDesc.js";
import { PER_OBJECT_VS } from "../core/Tr2Renderer.js";
import { Tr2RenderUtils } from "../core/Tr2RenderUtils.js";
import { Tr2Effect } from "../shader/Tr2Effect.js";
import { Tr2EffectStateManager } from "../shader/Tr2EffectStateManager.js";

/** Bytes of one RGBA32UI texel. */
const TEXEL_SIZE = 16;

/** Texels to a params row, as ParticleState.fxh addresses them. */
const PARAMS_WIDTH = 2048;

/** Rows of the params texture: 16,384 entries of eight texels. */
const PARAMS_HEIGHT = 64;

// The WebGL tree by name: these effects exist nowhere else, and building them must not
// wait on the page's file index, which the path conversion asks.
const UPDATE_EFFECT = "res:/graphics/effect.webgl/cjs/specialfx/gpuparticles/update.sm_hi";
const EMIT_EFFECT = "res:/graphics/effect.webgl/cjs/specialfx/gpuparticles/emit.sm_hi";
const DRAW_EFFECT = "res:/graphics/effect.webgl/cjs/specialfx/gpuparticles/quads.sm_hi";

const PIXEL_MASK = 1 << ShaderType.PIXEL_SHADER;
const VERTEX_MASK = 1 << ShaderType.VERTEX_SHADER;

/** Bytes of the update constants: four rows. */
const UPDATE_CB_SIZE = 64;

/** Bytes of the emit constants: eight rows. */
const EMIT_CB_SIZE = 128;

/** Bytes of the draw constants: one row. */
const DRAW_CB_SIZE = 16;

/** Byte offset of the seed and params index in a packed EmitterGpu. */
const EMITTER_SEED_OFFSET = 60;

/** Draws one full-target triangle from the vertex index, for the update and emit passes. */
class FullTargetTriangle
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

/** The system's state textures, passes and ring cursor where there is no compute. */
export class Tr2GpuParticleSystemNoCompute
{
  static className = "Tr2GpuParticleSystemNoCompute";

  /**
   * WebGL2's default capacity (operator, 2026-11-07), a stated difference from
   * Carbon's 1,048,576. Timings and the scan behind it are on the design page.
   */
  static defaultCapacity = 262144;

  /**
   * @param {object} system The Tr2GpuParticleSystem.
   */
  constructor(system)
  {
    this.system = system;
    this._triangle = new FullTargetTriangle();
    this._updateEffect = null;
    this._emitEffect = null;
    this._drawEffect = null;
    this._state = null;
    this._current = 0;
    this._cursor = 0;
    this._capacity = 0;
    this._width = 0;
    this._params = null;
    this._paramsBytes = new Uint8Array(PARAMS_WIDTH * PARAMS_HEIGHT * TEXEL_SIZE); // alloc: the texture's upload, kept
    this._updateCB = new Tr2ConstantBufferAL();
    this._emitCB = new Tr2ConstantBufferAL();
    this._drawCB = new Tr2ConstantBufferAL();
    this._updateData = new Float32Array(UPDATE_CB_SIZE / 4); // alloc: constants, written each frame
    this._emitData = new Float32Array(EMIT_CB_SIZE / 4); // alloc: constants, written per request
    this._drawData = vec4.create();
  }

  /**
   * The slots to allocate: `maxParticles`, except that Carbon's default gives
   * way to this backend's, rounded up to a square of a power of two.
   *
   * @param {number} maxParticles The system's setting.
   * @param {number} carbonDefault Carbon's default for it.
   * @returns {number} The texture's width.
   */
  static widthFor(maxParticles, carbonDefault)
  {
    const wanted = maxParticles === carbonDefault ? Tr2GpuParticleSystemNoCompute.defaultCapacity : maxParticles;
    return 2 ** Math.ceil(Math.log2(Math.sqrt(Math.max(wanted, 1))));
  }

  /**
   * Creates what is missing. The system's own buffers need storage this backend lacks,
   * so they stay empty.
   *
   * @param {number} carbonDefault Carbon's default capacity.
   * @param {object} renderContext The Tr2RenderContext.
   * @returns {boolean} True when the textures exist.
   */
  Prepare(carbonDefault, renderContext)
  {
    const width = Tr2GpuParticleSystemNoCompute.widthFor(this.system.maxParticles, carbonDefault);
    if (this._state === null || width !== this._width)
    {
      const texture = (w, h, usage) => renderContext.CreateTexture(
        Tr2BitmapDimensions.create__TypeFormatWidthHeightDepthMipCount(TextureType.TEXTURE_2D, PixelFormat.PIXEL_FORMAT_R32G32B32A32_UINT, w, h, 1, 1),
        { gpuUsage: usage, cpuUsage: Tr2CpuUsage.NONE, msaa: new Tr2MsaaDesc(1, 0) });
      const target = Tr2GpuUsage.RENDER_TARGET | Tr2GpuUsage.SHADER_RESOURCE;
      this._state = [ [ texture(width, width, target), texture(width, width, target) ], [ texture(width, width, target), texture(width, width, target) ] ];
      this._params ??= texture(PARAMS_WIDTH, PARAMS_HEIGHT, target);
      this._width = width;
      this._capacity = width * width;
      this._current = 0;
      this._cursor = 0;
      this._drawData[0] = width;
      this.system._clearRequested = true;
    }
    return this._state[0][0] !== null;
  }

  /** Builds the effects, carrying over the resources the shipped effects are given. */
  _EnsureEffects()
  {
    if (this._updateEffect !== null) return;
    const build = (path, shipped) =>
    {
      const effect = new Tr2Effect();
      effect.effectFilePath = path;
      if (shipped)
      {
        effect.parameters.push(...shipped.parameters);
        effect.resources.push(...shipped.resources);
      }
      effect.Initialize();
      return effect;
    };
    this._updateEffect = build(UPDATE_EFFECT, this.system.update);
    this._emitEffect = build(EMIT_EFFECT, null);
    this._drawEffect = build(DRAW_EFFECT, this.system.render);
  }

  /**
   * Whether every effect can draw now.
   *
   * @returns {boolean} Whether they can.
   */
  IsGood()
  {
    this._EnsureEffects();
    return this._state !== null && this._updateEffect.IsGood() && this._emitEffect.IsGood() && this._drawEffect.IsGood();
  }

  /**
   * Draws a pass into the state pair.
   *
   * @param {object} effect The pass's effect.
   * @param {Array<object>} targets The pair to write.
   * @param {object|null} viewport The rows to limit it to, or null for all.
   * @param {object} renderContext The Tr2RenderContext.
   */
  _Pass(effect, targets, viewport, renderContext)
  {
    const esm = renderContext.GetEffectStateManager();
    esm.PushDepthStencilBuffer__TextureAL(null);
    esm.PushRenderTarget__TextureAL(targets[0]);
    esm.PushRenderTarget__TextureAL(targets[1], 1);
    try
    {
      if (viewport) renderContext.SetViewport(viewport);
      effect.Render(this._triangle, renderContext);
    }
    finally
    {
      esm.PopRenderTarget(1);
      esm.PopRenderTarget();
      esm.PopDepthStencilBuffer();
    }
  }

  /**
   * One update pass: the shipped simulation, or with `clear` every slot retired.
   *
   * @param {number} dt The frame time.
   * @param {ArrayLike<number>} originShift The origin shift.
   * @param {ArrayLike<number>} turbulenceOffset The turbulence offset.
   * @param {ArrayLike<number>} turbulenceAnimation The turbulence animation.
   * @param {boolean} clear Whether to retire every slot.
   * @param {object} renderContext The Tr2RenderContext.
   */
  Simulate(dt, originShift, turbulenceOffset, turbulenceAnimation, clear, renderContext)
  {
    const data = this._updateData;
    data[0] = clear ? 1 : 0;
    data[3] = dt;
    for (let i = 0; i < 3; i++)
    {
      data[4 + i] = originShift[i];
      data[8 + i] = turbulenceOffset[i];
      data[12 + i] = turbulenceAnimation[i];
    }
    Tr2RenderUtils.fillAndSetConstants(this._updateCB, data, UPDATE_CB_SIZE, PIXEL_MASK, PER_OBJECT_VS, renderContext);

    const effect = this._updateEffect, source = this._state[this._current], next = 1 - this._current;
    effect.SetParameter__TextureAL("ParticleState0", source[0]);
    effect.SetParameter__TextureAL("ParticleState1", source[1]);
    effect.SetParameter__TextureAL("EmitterParams", this._params);
    this._Pass(effect, this._state[next], null, renderContext);
    this._current = next;
  }

  /** Retires every slot and rewinds the ring. */
  Clear(renderContext)
  {
    this._cursor = 0;
    this.Simulate(0, [ 0, 0, 0 ], [ 0, 0, 0 ], [ 0, 0, 0 ], true, renderContext);
    return true;
  }

  /**
   * Writes the requests into the ring.
   *
   * @adapted a CPU cursor stands in for the dead list, so at saturation the oldest
   *   slots are overwritten, where Carbon drops the new particles.
   * @param {Array<object>} requests The system's emit requests.
   * @param {number} count How many are live.
   * @param {object} renderContext The Tr2RenderContext.
   */
  Emit(requests, count, renderContext)
  {
    const data = this._emitData, capacity = this._capacity, width = this._width;
    for (let r = 0; r < count; r++)
    {
      const view = requests[r].emitterWords;
      const slots = Math.min(view.getUint32(12, true), capacity);
      if (slots === 0) continue;

      const start = this._cursor;
      const seedWord = view.getUint32(EMITTER_SEED_OFFSET, true);
      data[0] = start;
      data[1] = slots;
      data[2] = width;
      data[3] = capacity;
      data[4] = seedWord >>> 16;
      data[5] = seedWord & 0xffff;
      data.set(new Float32Array(view.buffer, view.byteOffset, 3), 8); // alloc: a view of the request's position
      data[11] = view.getFloat32(28, true);
      data.set(new Float32Array(view.buffer, view.byteOffset + 16, 3), 12); // alloc: a view of its previous position
      data.set(new Float32Array(view.buffer, view.byteOffset + 32, 4), 16); // alloc: a view of its direction and angle
      data.set(new Float32Array(view.buffer, view.byteOffset + 48, 3), 20); // alloc: a view of its previous direction
      data[23] = view.getFloat32(96, true);
      data.set(new Float32Array(view.buffer, view.byteOffset + 64, 4), 24); // alloc: a view of its velocity and speed
      data.set(new Float32Array(view.buffer, view.byteOffset + 80, 4), 28); // alloc: a view of its previous velocity

      Tr2RenderUtils.fillAndSetConstants(this._emitCB, data, EMIT_CB_SIZE, PIXEL_MASK, PER_OBJECT_VS, renderContext);

      // Only the rows the run touches, unless it wraps past the end.
      const end = start + slots;
      const first = Math.floor(start / width), last = Math.ceil(end / width);
      const viewport = end > capacity ? null : { x: 0, y: first, width, height: last - first, minZ: 0, maxZ: 1 };
      this._Pass(this._emitEffect, this._state[this._current], viewport, renderContext);
      this._cursor = end % capacity;
    }
  }

  /**
   * Uploads the system's params mirror.
   *
   * @param {Uint8Array} mirror The packed params.
   * @param {number} bytes How much of it is live.
   * @param {object} renderContext The Tr2RenderContext.
   */
  UpdateEmitterParams(mirror, bytes, renderContext)
  {
    if (this._params === null || bytes === 0) return;
    this._paramsBytes.set(mirror.subarray(0, Math.min(bytes, this._paramsBytes.length)));
    const result = this._params.UpdateSubresource(Tr2TextureSubresource.create__MipLevel(0), this._paramsBytes, PARAMS_WIDTH * TEXEL_SIZE, 0, renderContext);
    if (Failed(result)) CcpLog.CCP_LOGERR_CH(CcpLog.GetModuleChannel("trinity"), "%s", `Tr2GpuParticleSystemNoCompute: emitter params upload failed (0x${(result >>> 0).toString(16)})`);
  }

  /**
   * Binds the draw and runs it, with `callback` submitting its geometry.
   *
   * @param {object} callback The IRenderCallback.
   * @param {object} renderContext The Tr2RenderContext.
   */
  Render(callback, renderContext)
  {
    const effect = this._drawEffect, state = this._state[this._current];
    effect.SetParameter__TextureAL("ParticleState0", state[0]);
    effect.SetParameter__TextureAL("ParticleState1", state[1]);
    effect.SetParameter__TextureAL("EmitterParams", this._params);
    Tr2RenderUtils.fillAndSetConstants(this._drawCB, this._drawData, DRAW_CB_SIZE, VERTEX_MASK, PER_OBJECT_VS, renderContext);
    effect.Render(callback, renderContext);
  }

  /**
   * Six vertices to every slot; the vertex stage collapses dead ones.
   *
   * @param {object} renderContext The Tr2RenderContext.
   */
  SubmitGeometry(renderContext)
  {
    renderContext.SetTopology(Topology.TOP_TRIANGLES);
    renderContext.GetEffectStateManager().ApplyVertexDeclaration(Tr2EffectStateManager.NullDeclaration);
    renderContext.DrawInstanced(this._capacity * 6, 1, 0, 0);
  }
}
