import assert from "node:assert/strict";
import test from "node:test";
import { Tr2ShaderBuffer } from "../../npm/dist/trinity/index.js";

test("ShaderBuffer public destruction drops owned copied bytes and preserves peer payloads", () =>
{
  const source = new Uint8Array([1, 2, 3, 4]);
  const owner = new Tr2ShaderBuffer(), peer = new Tr2ShaderBuffer();
  owner.SetData(source);
  peer.SetData(source);
  assert.notEqual(owner.data, source);
  owner.Destruct();
  owner.Destruct();
  assert.equal(owner.data, null);
  assert.equal(owner.size, 0);
  assert.deepEqual(peer.data, source);
  assert.equal(peer.size, 4);
});
