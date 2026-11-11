import assert from "node:assert/strict";
import test from "node:test";
import { Tr2Sprite2dArc } from "../../npm/dist/trinity/index.js";

test("Tr2Sprite2dArc public teardown clears only its prepared geometry", () =>
{
  const owner = new Tr2Sprite2dArc(), peer = new Tr2Sprite2dArc();
  for (const sprite of [owner, peer])
  {
    sprite._renderVertices = [1, 2, 3];
    sprite._renderIndices.push(0, 1, 2);
    sprite._renderVertexCapacity = 3;
    sprite._renderVertexCount = 3;
  }
  owner.Destruct();
  owner.Destruct();
  assert.deepEqual(owner._renderVertices, null);
  assert.deepEqual(owner._renderIndices, []);
  assert.equal(owner._renderVertexCapacity, 0);
  assert.equal(owner._renderVertexCount, 0);
  assert.deepEqual(peer._renderVertices, [1, 2, 3]);
  assert.deepEqual(peer._renderIndices, [0, 1, 2]);
});
