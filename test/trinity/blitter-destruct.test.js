import assert from "node:assert/strict";
import test from "node:test";
import { Tr2Blitter, Tr2VariableStore } from "../../npm/dist/trinity/index.js";
import { TriVariableContentType } from "../../npm/dist/trinity/generated/trinityCore/enums.js";

test("blitter hook unregisters its globals while preserving unrelated variables", () =>
{
  const blitter = new Tr2Blitter();
  const store = Tr2VariableStore.globalStore();
  store.RegisterVariableInternal("mipLevel", TriVariableContentType.TRIVARIABLE_FLOAT, 2);
  store.RegisterVariableInternal("BlitterDestructPeer", TriVariableContentType.TRIVARIABLE_FLOAT, 7);
  const peer = store.FindVariable("BlitterDestructPeer");
  assert.ok(store.FindVariable("BlitSource"));
  assert.ok(store.FindVariable("mipLevel"));
  try
  {
    blitter.Destruct();
    blitter.Destruct();
    assert.equal(store.FindVariable("BlitSource"), null);
    assert.equal(store.FindVariable("mipLevel"), null);
    assert.equal(store.FindVariable("BlitterDestructPeer"), peer);
  }
  finally
  {
    blitter.Destruct();
    store.UnregisterVariable("BlitterDestructPeer");
  }
});
