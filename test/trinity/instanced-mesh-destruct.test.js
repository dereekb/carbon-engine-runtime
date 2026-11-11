import test from "node:test";
import assert from "node:assert/strict";
import { Tr2DirectInstanceData, Tr2InstancedMesh, Tr2MeshArea, Tr2VertexDefinition,
  Tr2EffectStateManager, Tr2RenderContext_GetMainThreadRenderContext } from "../../npm/dist/trinity/index.js";
import { Tr2RenderContextALStub } from "../../npm/dist/trinityal/index.js";

test("instanced mesh destruction detaches providers without releasing a peer's instance buffer", t =>
{
  const context = Tr2RenderContext_GetMainThreadRenderContext();
  const previous = context.GetRenderContextAL();
  const al = new Tr2RenderContextALStub();
  al.CreateDevice();
  al.BeginScene();
  context.SetRenderContextAL(al);
  const provider = new Tr2DirectInstanceData(), loaded = new Tr2DirectInstanceData();
  const mesh = new Tr2InstancedMesh(), peer = new Tr2InstancedMesh();
  t.after(() =>
  {
    mesh.Destruct();
    peer.Destruct();
    provider.Destruct();
    loaded.Destruct();
    context.SetRenderContextAL(previous);
    al.Destroy();
  });
  const layout = new Tr2VertexDefinition();
  layout.Add("FLOAT32_3", "POSITION");
  for (const value of [provider, loaded])
  {
    value.SetLayout(layout);
    assert.ok(value.GetData(1));
    value.UpdateData();
  }
  mesh.SetInstanceGeometryRes(provider);
  peer.SetInstanceGeometryRes(provider);
  mesh._loadedGeometryResource = loaded;
  mesh.CreateVertexDeclaration();
  assert.notEqual(mesh._instanceDeclaration, Tr2EffectStateManager.Unknown);
  const area = new Tr2MeshArea();
  mesh.opaqueAreas.Append(area);
  peer.opaqueAreas.Append(area);
  mesh.Destruct();
  mesh.Destruct();
  assert.equal(mesh.GetInstanceGeometryResource(), null);
  assert.equal(mesh._loadedGeometryResource, null);
  assert.equal(mesh._vertexDeclaration, Tr2EffectStateManager.Unknown);
  assert.equal(mesh._instanceDeclaration, Tr2EffectStateManager.Unknown);
  assert.deepEqual(area.GetOwnerMeshes(), [peer]);
  assert.equal(peer.GetInstanceGeometryResource(), provider);
  for (const value of [provider, loaded])
  {
    assert.equal(value.IsInstanceDataReady(), true);
    assert.ok(value.GetData(1));
    value.UpdateData();
  }
});
