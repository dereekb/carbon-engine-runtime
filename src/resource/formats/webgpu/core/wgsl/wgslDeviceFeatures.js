/** What `requireWgslFeature` throws with, so a caller can tell a missing feature from a failed translation. */
export const WGSL_FEATURE_UNAVAILABLE = "WGSL_FEATURE_UNAVAILABLE";

/** The features of the device translations are for. Empty until a device reports them, as for headless tools. */
let deviceFeatures = new Set();

/**
 * Records the features of the device WGSL is translated for.
 *
 * @param {Iterable<string>} features The device's `GPUSupportedFeatures`.
 * @returns {void}
 */
export function setWgslDeviceFeatures(features)
{
  deviceFeatures = new Set(features);
}

/**
 * Refuses a translation the device could not run. WebGPU rejects such a shader at
 * pipeline creation, so the permutation is better not selected at all.
 *
 * @param {string} feature The `GPUFeatureName` the shader needs.
 * @param {string} what What needs it, for the message.
 * @returns {void}
 * @throws {Error} With code `WGSL_FEATURE_UNAVAILABLE` when the device lacks the feature.
 */
export function requireWgslFeature(feature, what)
{
  if (deviceFeatures.has(feature)) return;
  throw Object.assign(new Error(`${what} needs the ${feature} WebGPU feature`), { code: WGSL_FEATURE_UNAVAILABLE });
}
