import "../../npm/dist/blue/values.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { CjsSchema } from "../../npm/dist/blue/schema/index.js";
import { HostBitmap } from "../../npm/dist/global/imageio/index.js";
import { CjsPngFormat } from "../../npm/dist/resource/formats/png/index.js";
import { Tr2HostBitmap } from "../../npm/dist/trinity/core/Tr2HostBitmap.js";

test("Trinity bitmap destruction releases CPU bytes while retaining native dimensions and external views", () =>
{
  const bitmap = new Tr2HostBitmap(), peer = new Tr2HostBitmap();
  const format = Tr2HostBitmap.PixelFormat.PIXEL_FORMAT_R8G8B8A8_UNORM;
  assert.equal(bitmap.Create(2, 2, 1, format), true);
  assert.equal(peer.Create(2, 2, 1, format), true);
  const retained = bitmap.GetRawData();
  retained.fill(23);
  peer.GetRawData().fill(51);
  for (let repeat = 0; repeat < 2; repeat++)
  {
    bitmap.Destruct();
    assert.equal(bitmap.IsValid(), false);
    assert.equal(bitmap.GetRawData(), null);
    assert.equal(bitmap.GetRawDataSize(), 0);
    assert.deepEqual([bitmap.GetWidth(), bitmap.GetHeight()], [2, 2]);
    assert.ok(retained.every(value => value === 23));
    assert.equal(peer.IsValid(), true);
    assert.ok(peer.GetRawData().every(value => value === 51));
  }
  peer.Destruct();
});

test("maintained Trinity host bitmap shares native storage with a decoded PNG", async () =>
{
  const rgba = Uint8Array.from({ length: 16 * 8 * 4 }, (_, i) => (i * 37 + 11) & 255);
  const bytes = await CjsPngFormat.writeAsync({ width: 16, height: 8, data: rgba });
  const decoded = new HostBitmap();
  await CjsPngFormat.readImageNativeAsync(bytes, {}, decoded);
  assert.ok(decoded.GetWidth() > 0);
  assert.ok(decoded.GetHeight() > 0);
  const expected = [decoded.GetWidth(), decoded.GetHeight(), decoded.GetRawDataSize()];
  const bitmap = new Tr2HostBitmap();
  bitmap.Swap(decoded);
  assert.ok(bitmap instanceof HostBitmap);
  assert.deepEqual([bitmap.width, bitmap.height, bitmap.GetRawDataSize()], expected);
  const values = CjsSchema.getValues(bitmap);
  assert.equal(values.width, bitmap.GetWidth());
  assert.equal(values.height, bitmap.GetHeight());
  assert.equal(values.format, bitmap.GetFormat());
  CjsSchema.setValues(bitmap, { name: "decoded-png" });
  assert.equal(bitmap._name, "decoded-png");
  assert.equal(bitmap.name, "decoded-png");
  assert.equal("SetValues" in bitmap, false);
  const control = new Tr2HostBitmap();
  Object.defineProperty(control, "width", { value: 0 });
  control.Swap(bitmap);
  assert.notEqual(control.width, control.GetWidth(),
    "negative control: the old independent width snapshot diverges from native storage");
  assert.equal(existsSync(new URL("../../src/trinity/generated/trinityCore/Tr2HostBitmap.js", import.meta.url)), false);
  const manifest = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  assert.equal(manifest.exports["./trinity/generated/trinityCore/Tr2HostBitmap.js"], null);
  assert.throws(() => control.SaveAsync(), /not implemented/);
});
