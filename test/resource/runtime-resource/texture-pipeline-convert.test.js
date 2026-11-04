import assert from "node:assert/strict";
import test, { beforeEach, afterEach } from "node:test";
import { Worker } from "node:worker_threads";
import { BeCallbackMan, BlueCallbackMan } from "../../../npm/dist/blue/services/BlueCallbackMan.js";
import { DefaultConfiguration } from "../../../npm/dist/core/configuration.js";
import { BitmapDimensions, HostBitmap, Metadata } from "../../../npm/dist/global/imageio/index.js";
import { PixelFormat as P, TextureType as T } from "../../../npm/dist/global/consts/renderContext/index.js";
import * as CcpLog from "../../../npm/dist/global/logging/ccpLog.js";
import { CjsTexturePipelineStepConvert, Tr2TexturePipeline, Tr2TexturePipelineStepLoad } from "../../../npm/dist/resource/index.js";
import { CONVERT_BITMAP_CALLBACK, IMAGE_DECODE_CALLBACK_MODULES } from "../../../npm/dist/resource/imageio/imageDecodeCallbacks.js";

const jobs = [];
const echo = (channel, _type, data) =>
{
  if (channel.object === "CallbackMan" && data?.label === CONVERT_BITMAP_CALLBACK && data.event === "started") jobs.push(data);
};

beforeEach(() =>
{
  jobs.length = 0;
  BlueCallbackMan.CALLBACKMAN_DEBUGGING = true;
  CcpLog.RegisterLogEcho(echo);
  BeCallbackMan.RegisterCallbackModule(CONVERT_BITMAP_CALLBACK, IMAGE_DECODE_CALLBACK_MODULES[CONVERT_BITMAP_CALLBACK]);
  BeCallbackMan.SetThreadCount(1);
  BeCallbackMan.SetWorkerModule("callback-man-thread.mjs").SetWorkerFactory(() =>
  {
    const thread = new Worker(new URL("../fixtures/callback-man-thread.mjs", import.meta.url));
    const listeners = new Map();
    return {
      postMessage: (message, transfer) => thread.postMessage(message, transfer),
      terminate() { void thread.terminate(); },
      addEventListener(type, callback)
      {
        const fn = value => callback(type === "message" ? { data: value } : { error: value, message: String(value) });
        listeners.set(type, fn);
        thread.on(type, fn);
      },
      removeEventListener(type)
      {
        thread.off(type, listeners.get(type));
        listeners.delete(type);
      }
    };
  }).Run();
});

afterEach(async () =>
{
  if (BeCallbackMan.IsRunningOwnThreads()) await BeCallbackMan.Stop();
  CcpLog.UnregisterLogEcho(echo);
  BlueCallbackMan.CALLBACKMAN_DEBUGGING = false;
});

/** A synthetic BC1 array with two mip chains: solid red, then solid green. */
function compressed()
{
  const source = new HostBitmap();
  assert.ok(source.CreateFromBitmapDimensions(BitmapDimensions.create__AllFields(T.TEX_TYPE_2D, P.PIXEL_FORMAT_BC1_UNORM, 4, 4, 1, 3, 2)));
  for (let layer = 0; layer < 2; ++layer)
  {
    for (let mip = 0; mip < 3; ++mip)
      source.GetMipRawData(mip, layer).set(layer ? [0xE0, 0x07, 0, 0, 0, 0, 0, 0] : [0, 0xF8, 0, 0, 0, 0, 0, 0]);
  }
  source.metadata = new Metadata();
  source.metadata.cutout.width = 0.75;
  source.metadata.metadata.push(["duplicate", "one"], ["duplicate", "two"]);
  return source;
}

test("pipeline conversion runs on a registered worker and preserves mips, layers, metadata and source storage", async () =>
{
  assert.equal(DefaultConfiguration.callbackModules[CONVERT_BITMAP_CALLBACK], IMAGE_DECODE_CALLBACK_MODULES[CONVERT_BITMAP_CALLBACK]);
  const source = compressed();
  const original = source.GetRawData().slice();
  const inputs = new Map([["res:/source.dds", source]]);
  const load = new Tr2TexturePipelineStepLoad();
  load.path = "res:/source.dds";
  const pipeline = new Tr2TexturePipeline();
  pipeline.steps = [new CjsTexturePipelineStepConvert(), load];
  const result = new HostBitmap();

  assert.equal(await pipeline.Execute(result, inputs), true);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].thread, "BeCallbackMan");
  assert.equal(BeCallbackMan.IsRunningOwnThreads(), true);
  const converted = inputs.get(load.path);
  assert.notEqual(converted, source);
  assert.equal(converted.GetFormat(), P.PIXEL_FORMAT_B8G8R8A8_UNORM);
  assert.equal(converted.GetMipCount(), 3);
  assert.equal(converted.GetArraySize(), 2);
  assert.deepEqual(converted.metadata, source.metadata);
  assert.notEqual(converted.metadata, source.metadata);
  for (let layer = 0; layer < 2; ++layer)
  {
    for (let mip = 0; mip < 3; ++mip)
      assert.deepEqual([...converted.GetMipRawData(mip, layer).subarray(0, 4)], layer ? [0, 255, 0, 255] : [0, 0, 255, 255]);
  }
  assert.equal(result.GetFormat(), converted.GetFormat(), "the following step awaited conversion");
  assert.equal(source.GetFormat(), P.PIXEL_FORMAT_BC1_UNORM);
  assert.deepEqual(source.GetRawData(), original, "worker input was neither modified nor transferred");
});

test("matching and unselected inputs retain identity without queuing a conversion", async () =>
{
  const source = compressed();
  const matching = new HostBitmap();
  matching.Create(1, 1, 1, P.PIXEL_FORMAT_B8G8R8A8_UNORM);
  const inputs = new Map([["selected", matching], ["untouched", source]]);
  const convert = new CjsTexturePipelineStepConvert();
  convert.paths = ["selected"];

  assert.equal(await convert.Execute(new HostBitmap(), inputs), true);
  assert.equal(inputs.get("selected"), matching);
  assert.equal(inputs.get("untouched"), source);
  assert.equal(jobs.length, 0);
});

test("cancellation passed through Execute discards completed and in-flight copies", async t =>
{
  const first = compressed(), second = compressed();
  const inputs = new Map([["first", first], ["second", second]]);
  const pipeline = new Tr2TexturePipeline();
  pipeline.steps = [new CjsTexturePipelineStepConvert()];
  const before = new AbortController();
  before.abort();
  assert.equal(await pipeline.Execute(new HostBitmap(), inputs, undefined, { signal: before.signal }), false);
  assert.equal(jobs.length, 0);

  const running = new AbortController();
  const abortSecond = (channel, _type, data) =>
  {
    if (channel.object === "CallbackMan" && data?.label === CONVERT_BITMAP_CALLBACK && data.event === "started" && jobs.length === 2)
      queueMicrotask(() => running.abort());
  };
  CcpLog.RegisterLogEcho(abortSecond);
  t.after(() => CcpLog.UnregisterLogEcho(abortSecond));
  assert.equal(await pipeline.Execute(new HostBitmap(), inputs, undefined, { signal: running.signal }), false);
  assert.equal(jobs.length, 2);
  assert.equal(inputs.get("first"), first);
  assert.equal(inputs.get("second"), second);
  assert.equal(first.GetRawDataSize(), first.GetRawData().byteLength);
});

test("failed or missing conversion inputs publish no replacement", async () =>
{
  const source = compressed();
  const inputs = new Map([["first", source]]);
  const convert = new CjsTexturePipelineStepConvert();
  convert.paths = ["first", "missing"];
  assert.equal(await convert.Execute(new HostBitmap(), inputs), false);
  assert.equal(inputs.get("first"), source);
  convert.paths = [];
  convert.format = P.PIXEL_FORMAT_BC3_UNORM;
  assert.equal(await convert.Execute(new HostBitmap(), inputs), false);
  assert.equal(inputs.get("first"), source);
});

test("a host without workers runs the same queued conversion through Update", async t =>
{
  await BeCallbackMan.Stop();
  BeCallbackMan.Start(false);
  const source = compressed();
  const inputs = new Map([["source", source]]);
  const pending = new CjsTexturePipelineStepConvert().Execute(new HostBitmap(), inputs);
  assert.equal(inputs.get("source"), source, "Execute does not synchronously decode on the caller");
  assert.equal(jobs.length, 0);
  const pump = setInterval(() => BeCallbackMan.Update(), 1);
  t.after(() => clearInterval(pump));

  assert.equal(await pending, true);
  assert.equal(jobs.length, 1);
  assert.equal(BeCallbackMan.IsRunningOwnThreads(), false);
  assert.equal(inputs.get("source").GetFormat(), P.PIXEL_FORMAT_B8G8R8A8_UNORM);
  assert.equal(source.GetFormat(), P.PIXEL_FORMAT_BC1_UNORM);
});
