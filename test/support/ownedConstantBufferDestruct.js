import assert from "node:assert/strict";
import { Tr2RenderContext } from "../../npm/dist/trinity/core/index.js";
import { Tr2ConstantBufferAL } from "../../npm/dist/trinityal/index.js";

export function assertOwnedConstantBufferDestruct(owner, fields)
{
  const context = new Tr2RenderContext();
  context.GetRenderContextAL().CreateDevice();
  const entries = fields.map(field =>
  {
    const buffer = owner[field];
    buffer.Create__Size(16, context);
    assert.equal(buffer.IsValid(), true);
    const peer = new Tr2ConstantBufferAL({ copy: buffer });
    return { field, buffer, peer, shared: peer._buffer };
  });
  try
  {
    for (let repeat = 0; repeat < 2; repeat++)
    {
      owner.Destruct();
      for (const { field, buffer, peer, shared } of entries)
      {
        assert.equal(owner[field], buffer);
        assert.equal(buffer.IsValid(), false);
        assert.equal(peer.IsValid(), true);
        assert.equal(shared.owners, 1);
      }
    }
  }
  finally { for (const { peer } of entries) peer.Destroy(); }
  for (const { shared } of entries)
  {
    assert.equal(shared.owners, 0);
    assert.equal(shared.implementation.IsValid(), false);
  }
}
