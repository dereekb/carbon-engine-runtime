import assert from "node:assert/strict";
import { test } from "node:test";

import { Tr2RenderContextALStub } from "../../npm/dist/trinityal/index.js";
import { Tr2RenderContextALWebgl2, Tr2CapsALWebgl2 } from "../../npm/dist/trinityal/webgl2/index.js";
import * as core from "../../npm/dist/trinity/core/index.js";
import { FakeWebgl2 } from "../trinityal/webgl2/fakeWebgl2.js";

const { Tr2PerObjectData, Tr2PerObjectDataStandard, Tr2RenderContext } = core;

test("only WebGL2 carries bones in a block, sized as the emitter sizes it", () =>
{
  assert.equal(new Tr2CapsALWebgl2().BONE_BLOCK_CAPACITY, 69);
  assert.equal(new Tr2RenderContextALStub().GetCaps().BONE_BLOCK_CAPACITY, 0);
});

test("a palette past the block's capacity is refused and reported once, and a fitting one is kept", () =>
{
  const palette = new Float32Array(69 * 12);
  const fitting = new Tr2PerObjectDataStandard();
  fitting.SetBoneBlock(palette, 69, 69, "fitting owner");
  assert.equal(fitting.boneBlock, palette);
  assert.equal(fitting.boneBlockCount, 69);

  const over = new Tr2PerObjectDataStandard();
  over.SetBoneBlock(new Float32Array(70 * 12), 70, 69, "oversized owner");
  assert.equal(over.boneBlock, null, "an over-capacity object has no palette, so its draw does not happen");
  assert.equal(over.boneBlockCount, 0);
  assert.ok(Tr2PerObjectData.reportedBoneOverflows.has("oversized owner:70"));
  assert.equal(Tr2PerObjectData.fitsBoneBlock(70, 69, "oversized owner"), false, "reports once and still refuses");
});

test("the draw hands a backend with a bone block each object's palette, and the ring backends nothing", () =>
{
  const palette = new Float32Array(12);
  const handed = [];

  const context = new Tr2RenderContext();
  const al = new Tr2RenderContextALStub();
  al.GetCaps = () => ({ BONE_BLOCK_CAPACITY: 69 });
  al.SetBoneBlock = (transforms, count) => handed.push([ transforms, count ]);
  al.CreateDevice({ mode: { width: 8, height: 8 } });
  context.SetRenderContextAL(al);

  context._ApplyBoneBlock({ vs: null, ps: null, boneBlock: palette, boneBlockCount: 1 });
  context._ApplyBoneBlock({ vs: null, ps: null });
  context._ApplyBoneBlock(null);
  assert.deepEqual(handed, [ [ palette, 1 ], [ null, 0 ], [ null, 0 ] ]);

  const ring = new Tr2RenderContext();
  const ringAl = new Tr2RenderContextALStub();
  ringAl.CreateDevice({ mode: { width: 8, height: 8 } });
  ring.SetRenderContextAL(ringAl);
  ring._ApplyBoneBlock({ boneBlock: palette, boneBlockCount: 1 });
});

test("a program's block fills from the palette once a frame per palette, and a draw with none does not proceed", () =>
{
  const { gl, calls } = FakeWebgl2();
  const al = new Tr2RenderContextALWebgl2({ gl });
  const program = { GetBoneBlocks: () => [ { name: "CjsSb0", bindingPoint: 3, byteLength: 69 * 48 } ] };
  const uploads = () => calls.filter(call => call[0] === "bufferSubData").length;

  assert.equal(al._ApplyBoneBlocks({ GetBoneBlocks: () => [] }), true, "a program with no block is untouched");
  assert.equal(al._ApplyBoneBlocks(program), false, "no palette, no draw");

  const first = new Float32Array(2 * 12).fill(1), second = new Float32Array(12).fill(2);
  al.SetBoneBlock(first, 2);
  assert.equal(al._ApplyBoneBlocks(program), true);
  assert.equal(uploads(), 1);

  assert.equal(al._ApplyBoneBlocks(program), true, "another area of the same object");
  assert.equal(uploads(), 1, "the same palette is not copied twice");

  al.SetBoneBlock(second, 1);
  al._ApplyBoneBlocks(program);
  assert.equal(uploads(), 2, "the next object brings its own bones");

  al.BeginScene();
  al._ApplyBoneBlocks(program);
  assert.equal(uploads(), 3, "a palette is rewritten in place, so a new frame copies it again");
});
