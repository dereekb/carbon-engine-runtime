import assert from "node:assert/strict";
import test from "node:test";
import { CjsWebgl2VideoColorSampler } from "../../../npm/dist/trinityal/webgl2/index.js";

/** A uniform frame's planes in `format`, with each plane's layout. */
function uniformFrame(format, width, height, [ y, u, v ], alpha = 255)
{
  const hw = (width + 1) >> 1, hh = (height + 1) >> 1;
  const planes = format === "NV12" ? [ [ width, height, 1, [ y ] ], [ hw, hh, 2, [ u, v ] ] ]
    : format === "I420A" ? [ [ width, height, 1, [ y ] ], [ hw, hh, 1, [ u ] ], [ hw, hh, 1, [ v ] ], [ width, height, 1, [ alpha ] ] ]
      : [ [ width, height, 1, [ y ] ], [ hw, hh, 1, [ u ] ], [ hw, hh, 1, [ v ] ] ];
  const layout = [], parts = [];
  let offset = 0;
  for (const [ w, h, step, values ] of planes)
  {
    // A stride wider than the row, with junk in the padding, as decoders give.
    const stride = w * step + 3, bytes = new Uint8Array(stride * h).fill(77);
    for (let row = 0; row < h; row++) for (let i = 0; i < w * step; i++) bytes[row * stride + i] = values[i % values.length];
    layout.push({ offset, stride });
    parts.push(bytes);
    offset += bytes.length;
  }
  const all = new Uint8Array(offset);
  let at = 0;
  for (const part of parts) { all.set(part, at); at += part.length; }
  return { bytes: all, layout };
}

const close = (actual, expected, tolerance, message) =>
  expected.forEach((value, i) => assert.ok(Math.abs(actual[i] - value) <= tolerance, `${message}: channel ${i} ${actual[i]} vs ${value}`));

test("plane means convert with the frame's tagged matrix and range (fixes CE-235)", () =>
{
  const bt709 = { matrix: "bt709", fullRange: false };
  // Limited-range mid grey: Y 126, no chroma.
  let { bytes, layout } = uniformFrame("NV12", 5, 3, [ 126, 128, 128 ]);
  close(CjsWebgl2VideoColorSampler.meanOf(bytes, layout, "NV12", 5, 3, bt709), [ 110 / 219, 110 / 219, 110 / 219, 1 ], 1e-6, "grey");
  // BT.709 limited-range pure red is Y 63, Cb 102, Cr 240.
  ({ bytes, layout } = uniformFrame("I420", 4, 4, [ 63, 102, 240 ]));
  close(CjsWebgl2VideoColorSampler.meanOf(bytes, layout, "I420", 4, 4, bt709), [ 1, 0, 0, 1 ], 0.01, "BT.709 red");
  // An unsaturated colour reads differently under BT.601: the tag matters.
  ({ bytes, layout } = uniformFrame("I420", 4, 4, [ 100, 110, 160 ]));
  const as709 = CjsWebgl2VideoColorSampler.meanOf(bytes, layout, "I420", 4, 4, bt709);
  const as601 = CjsWebgl2VideoColorSampler.meanOf(bytes, layout, "I420", 4, 4, { matrix: "smpte170m", fullRange: false });
  assert.ok(Math.abs(as709[1] - as601[1]) > 0.02, "BT.601 and BT.709 give different green");
  // Untagged is BT.601, limited.
  ({ bytes, layout } = uniformFrame("I420", 4, 4, [ 81, 90, 240 ]));
  close(CjsWebgl2VideoColorSampler.meanOf(bytes, layout, "I420", 4, 4, null), [ 1, 0, 0, 1 ], 0.01, "BT.601 red, untagged");
  // Full range: Y 255 with no chroma is white.
  ({ bytes, layout } = uniformFrame("I420", 3, 3, [ 255, 128, 128 ]));
  close(CjsWebgl2VideoColorSampler.meanOf(bytes, layout, "I420", 3, 3, { matrix: "bt709", fullRange: true }), [ 1, 1, 1, 1 ], 1e-6, "full-range white");
});

test("alpha comes from an I420A plane, and RGB formats are averaged directly", () =>
{
  let { bytes, layout } = uniformFrame("I420A", 4, 2, [ 126, 128, 128 ], 51);
  assert.equal(CjsWebgl2VideoColorSampler.meanOf(bytes, layout, "I420A", 4, 2, { matrix: "bt709", fullRange: false })[3], Math.fround(51 / 255));
  const rgba = new Uint8Array([ 10, 20, 30, 255, 30, 40, 50, 255 ]);
  close(CjsWebgl2VideoColorSampler.meanOf(rgba, [ { offset: 0, stride: 8 } ], "BGRA", 2, 1, null), [ 40 / 255, 30 / 255, 20 / 255, 1 ], 1e-6, "BGRA");
  assert.equal(CjsWebgl2VideoColorSampler.meanOf(rgba, [ { offset: 0, stride: 8 } ], "I444P10", 2, 1, null), null, "unknown formats are not guessed");
});

test("one request at a time; busy answers null without the canvas fallback; no WebCodecs answers null", async () =>
{
  const sampler = new CjsWebgl2VideoColorSampler();
  const { bytes, layout } = uniformFrame("NV12", 2, 2, [ 126, 128, 128 ]);
  let release, closed = 0;
  class FakeFrame
  {
    format = "NV12"; visibleRect = { width: 2, height: 2 }; colorSpace = { matrix: "bt709", fullRange: false };
    allocationSize() { return bytes.length; }
    copyTo(target) { target.set(bytes); return new Promise(resolve => { release = () => resolve(layout); }); }
    close() { closed++; }
  }
  const video = { readyState: 4, ownerDocument: { defaultView: { VideoFrame: FakeFrame } } };
  const first = sampler.Request(video);
  assert.ok(first instanceof Promise);
  assert.equal(await sampler.Request(video), null, "busy: a resolved null, so VideoPlayer does not fall back");
  release();
  close(await first, [ 110 / 219, 110 / 219, 110 / 219, 1 ], 1e-6, "average");
  assert.equal(closed, 1, "the frame is closed");
  const second = sampler.Request(video);
  sampler.Destruct();
  release();
  assert.equal(await second, null, "destroyed mid-copy answers null");
  if (!globalThis.VideoFrame) assert.equal(new CjsWebgl2VideoColorSampler().Request({ readyState: 4, ownerDocument: { defaultView: {} } }), null, "no WebCodecs: null, so VideoPlayer keeps its fallback");
});
