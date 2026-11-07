import assert from "node:assert/strict";
import { test } from "node:test";

import { Tr2QuadRenderer } from "../../npm/dist/trinity/core/Tr2QuadRenderer/index.js";
import { ALResult } from "../../npm/dist/trinityal/index.js";

function renderer(result)
{
  const quads = new Tr2QuadRenderer();
  quads.bufferSize = 32;
  quads._buffer = new Uint8Array(32);
  quads._vertexBuffer = { IsValid: () => true, PutData: () => ({ result, offset: 0 }) };
  return quads;
}

test("a failed upload stops the quads drawing, though the failure code is unsigned", () =>
{
  assert.ok(ALResult.E_INVALIDCALL > 0, "the code this guards against reads as positive");
  const quads = renderer(ALResult.E_INVALIDCALL);
  quads.vertexBufferOffset = 0;
  quads.UpdateInstanceBuffer(null);
  assert.equal(quads.vertexBufferOffset, -1);
});

test("a successful upload records where the instances landed", () =>
{
  const quads = renderer(ALResult.S_OK);
  quads.UpdateInstanceBuffer(null);
  assert.equal(quads.vertexBufferOffset, 0);
  assert.equal(quads.lastInstanceDataSize, 32);
});
