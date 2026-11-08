// Ours: how a playing video's average colour is taken for the lights banners
// and planes derive from it. Carbon averages each decoded frame on the CPU
// (videoplayer/VpxDecoder.cpp:255-272); the browser decodes, so each backend
// takes the average its own way. One enum per backend, so each setting offers
// only its own options. OFF is 0 in both; no other value is shared.

/**
 * The WebGL2 backend's video average colour (Tr2PlatformInfo.webgl2LightAveraging).
 */
export const Webgl2LightAveraging = Object.freeze({
  /** No average is taken; the colour stays as it was. */
  OFF: 0,

  /** A small mip of the video texture, read back asynchronously: about 0.6 levels from the exact mean. */
  APPROXIMATION: 1,

  /** The frame's planes through WebCodecs: about 0.2 levels, but with main-thread spikes. Falls back to APPROXIMATION where WebCodecs is missing. */
  WEB_CODEC: 2
});

/**
 * The WebGPU backend's video average colour (Tr2PlatformInfo.webgpuLightAveraging).
 */
export const WebgpuLightAveraging = Object.freeze({
  /** No average is taken; the colour stays as it was. */
  OFF: 0,

  /** An exact compute reduction of the video texture. */
  COMPUTE: 3
});
