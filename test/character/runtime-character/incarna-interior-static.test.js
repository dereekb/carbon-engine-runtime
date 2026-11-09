import { prepareResourceFixture } from "../../support/resourceFixtures.js";
import assert from "node:assert/strict";
import test from "node:test";
import { blue } from "../../../npm/dist/blue/index.js";
import { CjsSchema } from "../../../npm/dist/blue/schema/index.js";
import { blackBuilder, readBlack } from "../../support/blackReader.js";
import { ITr2Interior, ITr2InteriorDynamic, Tr2HighLevelShader, Tr2InteriorCell, Tr2InteriorScene, Tr2InteriorStatic, Tr2ShaderFloat4Desc, Tr2ShaderManager, Tr2ShaderMaterial, Tr2ShaderPermuteTag, Tr2ShaderTexDesc } from "../../../npm/dist/character/index.js";
import { Tr2Effect, Tr2FloatParameter, TriTextureParameter } from "../../../npm/dist/trinity/shader/index.js";
import { ITr2Pickable, ITr2Renderable, Tr2Mesh, Tr2MeshArea, Tr2RenderContext_GetMainThreadRenderContext, TriPoolAllocator } from "../../../npm/dist/trinity/index.js";
import { TriRenderBatchAccumulator } from "../../../npm/dist/trinity/core/batch/TriRenderBatch/TriRenderBatchAccumulator.js";
import { Tr2VariableStore } from "../../../npm/dist/trinity/core/variable/Tr2VariableStore.js";
import { TriGeometryRes } from "../../../npm/dist/resource/index.js";
import { Tr2RenderContextALStub } from "../../../npm/dist/trinityal/index.js";
import { SharedGeometryBuffer } from "../../../npm/dist/trinity/core/mesh/TriGeometryResAllocations.js";
import { TriBatchType } from "../../../npm/dist/global/consts/graphics/index.js";
import { mat4 } from "../../../npm/dist/global/math/mat4.js";
import { Tr2Renderer } from "../../../npm/dist/trinity/core/Tr2Renderer.js";
import { StubResMan } from "../../support/stubResMan.js";

// The record shape of a captain's quarters walkway piece in build 1142708
// (res:/graphics/interior/<race>/modular_walkway/<piece>.black), in its file
// order: a Tr2InteriorStatic holding one Tr2Mesh whose prepass area holds a
// Tr2ShaderMaterial with a parameter dictionary.
function walkwayRecord()
{
  const f = new BlackFixture();
  const parameters = concat([ u32(2),
    f.String("OverlayMap"), f.Object(5, "TriTextureParameter", [ [ "name", f.String("OverlayMap") ], [ "resourcePath", f.String("res:/graphics/test/piece_os.dds") ] ]),
    f.String("ShadowTransparency"), f.Object(6, "Tr2FloatParameter", [ [ "name", f.String("ShadowTransparency") ], [ "value", f32(0.25) ] ]) ]);
  const material = f.Object(4, "Tr2ShaderMaterial", [
    [ "highLevelShaderName", f.String("IncarnaDetailed") ], [ "parameters", parameters ], [ "defaultSituation", f.String("TwoSided SHLighting") ] ]);
  const area = f.Object(3, "Tr2MeshArea", [ [ "name", f.String("Base_Glass_01") ], [ "index", u32(1) ], [ "effect", material ] ]);
  const mesh = f.Object(2, "Tr2Mesh", [
    [ "geometryResPath", f.String("res:/graphics/test/piece.gr2") ], [ "name", f.String("Piece_MeshShape") ], [ "meshIndex", u32(1) ],
    [ "opaquePrepassAreas", concat([ u32(1), area ]) ] ]);
  return f.Finish(f.Object(1, "Tr2InteriorStatic", [
    [ "name", f.String("Walkway_Test") ], [ "detailMeshes", concat([ u32(1), mesh ]) ], [ "geometryResPath", f.String("res:/graphics/test/piece.gr2") ] ]));
}

test("a walkway record hydrates the Incarna static and its shader material in file order", t =>
{
  renderSetup(t);
  const reader = blackBuilder(walkwayRecord(), { initialize: false });
  const root = reader.CreateObject(0);

  assert.equal(root.constructor, Tr2InteriorStatic);
  assert.equal(root.name, "Walkway_Test");
  assert.equal(root.geometryResPath, "res:/graphics/test/piece.gr2");
  assert.equal(root.detailMeshes.length, 1);

  const mesh = root.detailMeshes[0];
  assert.equal(mesh.constructor, Tr2Mesh);
  assert.equal(mesh.GetMeshIndex(), 1);
  assert.equal(mesh.opaquePrepassAreas.length, 1);

  const material = mesh.opaquePrepassAreas[0].effect;
  assert.equal(material.constructor, Tr2ShaderMaterial);
  assert.equal(material.highLevelShaderName, "IncarnaDetailed");
  assert.equal(material.defaultSituation, "TwoSided SHLighting");
  assert.deepEqual([ ...material.parameters.keys() ], [ "OverlayMap", "ShadowTransparency" ]);
  assert.equal(material.parameters.get("OverlayMap").resourcePath, "res:/graphics/test/piece_os.dds");
  assert.equal(material.parameters.get("ShadowTransparency").value, 0.25);
  assert.equal(material.IsGood(), false, "read without initializing, the material stays, and a material never draws");
  assert.equal(reader.GetErrorMessage(), "");
});

test("the static is Carbon's: an interior renderable that is picked, never a dynamic", t =>
{
  renderSetup(t);
  const value = staticWith([ mesh(0) ]);

  assert.equal(CjsSchema.cast(value, ITr2Interior), value);
  assert.equal(CjsSchema.cast(value, ITr2Renderable), value);
  assert.equal(CjsSchema.cast(value, ITr2Pickable), value);
  assert.equal(CjsSchema.cast(value, ITr2InteriorDynamic), null, "it reaches the scene through a cell, not as a dynamic");

  // Carbon's defaults (Interior/Tr2InteriorStatic.cpp:19-44 at trinity 24d033fa~1).
  assert.deepEqual([ ...value.worldPosition ], [ 0, 0, 0 ]);
  assert.deepEqual([ ...value.rotation ], [ 0, 0, 0, 1 ]);
  assert.deepEqual([ ...value.uvLinearTransform ], [ 1, 0, 0, 1 ]);
  assert.deepEqual([ ...value.uvTranslation ], [ 0, 0 ]);
  assert.equal(value.display, true);
  assert.equal(value.depthOffset, 0);
  assert.deepEqual([ ...value.worldTransform ], [ ...mat4.create() ]);

  value.SetInstanceData([ 2, 0, 0, 3 ], [ 0.25, 0.5 ], 7);
  assert.deepEqual([ ...value.uvLinearTransform ], [ 2, 0, 0, 3 ]);
  assert.deepEqual([ ...value.uvTranslation ], [ 0.25, 0.5 ]);
});

test("the transform follows worldPosition and rotation, and bounds are the geometry's meshes", t =>
{
  renderSetup(t, { "res:/graphics/test/piece.gr2": geometryOf([ 0, 10 ]) });
  const value = staticWith([ mesh(0) ]);
  value.geometryResPath = "res:/graphics/test/piece.gr2";
  value.rotation.set([ 0, 0, Math.SQRT1_2, Math.SQRT1_2 ]);
  value.worldPosition.set([ 100, 0, 0 ]);
  assert.equal(value.Initialize(), true);

  const expected = mat4.fromRotationTranslation(mat4.create(), value.rotation, value.worldPosition);
  assertClose([ ...value.GetWorldTransform() ], [ ...expected ]);

  const min = [ 0, 0, 0 ], max = [ 0, 0, 0 ];
  assert.equal(value.GetBoundingBox(min, max), true);
  assert.deepEqual([ ...min, ...max ], [ 0, -1, -1, 12, 1, 1 ], "the union of the geometry's two meshes");
  assert.equal(value.GetWorldBoundingBox(min, max), true);
  assertClose([ ...min, ...max ], [ 99, 0, -1, 101, 12, 1 ]);

  value.worldPosition.set([ 0, 0, 0 ]);
  value.OnModified("worldPosition");
  value.GetWorldBoundingBox(min, max);
  assertClose([ ...min, ...max ], [ -1, 0, -1, 1, 12, 1 ], "a moved piece rebuilds its world box");
});

test("an expired geometry link is reacquired on use, so the piece stays visible", t =>
{
  const geometry = geometryOf([ 0 ]);
  renderSetup(t, { "res:/graphics/test/piece.gr2": geometry });
  const value = staticWith([ mesh(0) ]);
  value.geometryResPath = "res:/graphics/test/piece.gr2";
  value.Initialize();
  const frustum = { IsBoxVisible__BoundsMinMax: () => true };
  assert.equal(value.IsInFrustum(frustum, mat4.create()), true);

  // What the resource manager does when the piece's link idles out.
  value.RemoveCachedData(geometry);
  assert.equal(value.geometry, null);
  const requests = blue.resMan.requests.length;

  assert.equal(value.IsInFrustum(frustum, mat4.create()), true, "culling reacquires the geometry");
  assert.equal(value.geometry, geometry);
  assert.equal(blue.resMan.requests.length, requests + 1);
});

test("per-object data carries the world matrix and the light-map UV placement", t =>
{
  renderSetup(t);
  const value = staticWith([ mesh(0) ]);
  value.SetInstanceData([ 2, 0, 0, 3 ], [ 0.25, 0.5 ], 0);
  const transform = mat4.fromTranslation(mat4.create(), [ 5, 6, 7 ]);

  const accumulator = new TriRenderBatchAccumulator().SetTriPoolAllocator(new TriPoolAllocator().RegisterCatalog());
  const data = value.GetPerObjectDataWithPerInstanceLighting(accumulator, null, transform);
  assertClose(Array.from(data.vs.Get("WorldMat")), Array.from(mat4.transpose(mat4.create(), transform)));
  assert.deepEqual(Array.from(data.vs.Get("uvLinearTransform")), [ 2, 0, 0, 3 ]);
  assert.deepEqual(Array.from(data.vs.Get("uvTranslation")), [ 0.25, 0.5 ]);
});

test("a cell's statics bind their effects under the cell's own store, which falls through to the global one", t =>
{
  renderSetup(t);
  const cell = new Tr2InteriorCell(), piece = mesh(0), value = staticWith([ piece ]);
  const effect = new Tr2Effect();
  piece.opaquePrepassAreas.push(area(effect));

  assert.equal(cell.GetVariableStore().GetParentVariableStore(), Tr2VariableStore.globalStore());
  for (const name of [ "ReflectionMap", "IrradianceMap", "DirectionalIrradianceMap" ])
  {
    assert.ok(cell.GetVariableStore().FindLocalVariable(name), `${name} is the cell's own`);
  }

  cell.AddStatic(value);
  assert.equal(value.GetParentCell(), cell);
  assert.equal(effect.GetVariableStore(), cell.GetVariableStore());

  cell.RemoveStatic(value);
  assert.equal(value.GetParentCell(), null);
  assert.equal(cell.statics.length, 0);
});

test("a cell's light maps go into its own store and leave the global store alone", t =>
{
  renderSetup(t);
  const global = Tr2VariableStore.globalStore().FindLocalVariable("IrradianceMap");
  const before = global ? global.GetValue() : null;
  const cell = new Tr2InteriorCell();

  cell.irradianceTexturePath = "res:/graphics/test/cell_rad.dds";
  cell.OnModified("irradianceTexturePath");
  cell.reflectionMapPath = "res:/graphics/test/cube.dds";
  cell.OnModified("reflectionMapPath");
  cell.Update(1);

  const store = cell.GetVariableStore();
  assert.equal(store.FindLocalVariable("IrradianceMap").GetValue(), cell.irradianceTexture);
  assert.equal(store.FindLocalVariable("ReflectionMap").GetValue(), cell.reflectionMap);
  assert.ok(cell.irradianceTexture && cell.reflectionMap);
  const after = Tr2VariableStore.globalStore().FindLocalVariable("IrradianceMap");
  assert.equal(after ? after.GetValue() : null, before);
});

test("the scene reaches a cell's statics: its box grows by them and a pick query finds them", t =>
{
  const { scene } = renderSetup(t, { "res:/graphics/test/piece.gr2": geometryOf([ 0 ]) });
  const value = staticWith([ mesh(0) ]);
  value.geometryResPath = "res:/graphics/test/piece.gr2";
  value.worldPosition.set([ 0, 0, 5 ]);
  value.Initialize();
  const cell = new Tr2InteriorCell();
  cell.AddStatic(value);

  const s = scene();
  s.cells.Insert(-1, cell);
  s.Update(1, 1);
  const min = [ 0, 0, 0 ], max = [ 0, 0, 0 ];
  assert.equal(cell.GetBoundingBox(min, max), true);
  assertClose([ ...min, ...max ], [ 0, -1, 4, 2, 1, 6 ]);

  // The pick query resolves the scene's visibility; the frustum test itself is the static's own.
  const asked = [];
  t.mock.method(value, "IsInFrustum", (_frustum, objectToWorld) => { asked.push(objectToWorld); return true; });
  const picked = s.GetPickingObjectsToRender([ 0, 0, -1 ]);
  assert.equal(asked.length, 1, "the scene asked the cell's static");
  assert.ok(picked.includes(value), "the static is visible through its cell");
  assert.equal(s.dynamics.length, 0);
});

test("an opaque request also draws the prepass areas, and only the opaque request does", t =>
{
  const { material } = renderSetup(t), piece = mesh(0), value = staticWith([ piece ]);
  const prepass = area(material), opaque = area(material), held = area(new Tr2ShaderMaterial());
  piece.opaquePrepassAreas.push(prepass, held);
  piece.opaqueAreas.push(opaque);

  const opaqueBatches = batchesOf(value, TriBatchType.TRIBATCHTYPE_OPAQUE);
  assert.equal(opaqueBatches.length, 2, "the opaque area and the prepass area; the area still holding Tr2ShaderMaterial is skipped");
  assert.equal(batchesOf(value, TriBatchType.TRIBATCHTYPE_OPAQUE_PREPASS).length, 1, "a direct prepass request is not doubled");
  assert.equal(batchesOf(value, TriBatchType.TRIBATCHTYPE_TRANSPARENT).length, 0);
});

// The record shape of build 1142708's res:/graphics/shaders/shaderdescriptions.black,
// in its file order: a Tr2ShaderManager whose library holds Tr2HighLevelShaders,
// each with permutation tags and parameter descriptions.
function shaderLibraryRecord()
{
  const f = new BlackFixture();
  const tag = f.Object(3, "Tr2ShaderPermuteTag", [
    [ "name", f.String("ReflectionGlow") ], [ "permuteDefineString", f.String("OPT_REFLECTION_GLOW") ], [ "tagBits", u32(0x400) ],
    [ "unused", f.String("OPT_GENERATE_ALBEDO") ], [ "predicate", f.String("not OPT_DYNAMIC_OBJECT") ], [ "precompileHint", u32(1) ] ]);
  const texture = f.Object(4, "Tr2ShaderTexDesc", [
    [ "defaultTexture", f.String("res:/texture/global/white.dds") ], [ "parameterName", f.String("DetailDiffuseMap") ],
    [ "name", f.String("DetailDiffuseMap") ], [ "helpText", f.String("High frequency Tiling Detail") ], [ "section", f.String("Base Maps") ] ]);
  const color = f.Object(5, "Tr2ShaderFloat4Desc", [
    [ "defaultValue", concat([ f32(1), f32(0.5), f32(0.25), f32(1) ]) ], [ "isColor", Uint8Array.of(1) ],
    [ "parameterName", f.String("MaterialDiffuseColor") ], [ "name", f.String("Diffuse Color") ],
    [ "helpText", f.String("Diffuse color multiplied against base diffuse") ], [ "section", f.String("Diffuse") ] ]);
  const shader = f.Object(2, "Tr2HighLevelShader", [
    [ "name", f.String("IncarnaSimple_Shadow") ], [ "shaderPath", f.String("res:/graphics/shaders/IncarnaDetailed_Shadow.fx") ],
    [ "permuteTags", concat([ u32(1), tag ]) ], [ "renderClass", f.String("shadow") ],
    [ "parameterDescriptions", concat([ u32(2), texture, color ]) ] ]);
  return f.Finish(f.Object(1, "Tr2ShaderManager", [ [ "shaderLibrary", concat([ u32(1), shader ]) ] ]));
}

test("a shader library record hydrates the Incarna shader classes in file order", t =>
{
  renderSetup(t);
  const reader = blackBuilder(shaderLibraryRecord(), { initialize: false });
  const root = reader.CreateObject(0);

  assert.equal(root.constructor, Tr2ShaderManager);
  const [ shader ] = root.shaderLibrary;
  assert.equal(shader.constructor, Tr2HighLevelShader);
  assert.equal(shader.name, "IncarnaSimple_Shadow");
  assert.equal(shader.shaderPath, "res:/graphics/shaders/IncarnaDetailed_Shadow.fx");
  assert.equal(shader.renderClass, "shadow");

  const [ tag ] = shader.permuteTags;
  assert.equal(tag.constructor, Tr2ShaderPermuteTag);
  assert.deepEqual([ tag.name, tag.permuteDefineString, tag.tagBits, tag.unused, tag.predicate, tag.precompileHint ],
    [ "ReflectionGlow", "OPT_REFLECTION_GLOW", 0x400, "OPT_GENERATE_ALBEDO", "not OPT_DYNAMIC_OBJECT", 1 ]);

  const [ texture, color ] = shader.parameterDescriptions;
  assert.equal(texture.constructor, Tr2ShaderTexDesc);
  assert.equal(texture.defaultTexture, "res:/texture/global/white.dds");
  assert.equal(texture.parameterName, "DetailDiffuseMap");
  assert.equal(color.constructor, Tr2ShaderFloat4Desc);
  assert.deepEqual(Array.from(color.defaultValue), [ 1, 0.5, 0.25, 1 ]);
  assert.equal(color.isColor, true);
  assert.equal(reader.GetErrorMessage(), "");
});

test("a material becomes a Tr2Effect holding its parameters, with its path from the shader's source", async t =>
{
  renderSetup(t);
  blue.resMan = new LibraryResMan(libraryNaming("IncarnaSimple_Shadow", "res:/graphics/shaders/IncarnaDetailed_Shadow.fx"));
  const material = new Tr2ShaderMaterial();
  material.highLevelShaderName = "IncarnaSimple_Shadow";
  const overlay = new TriTextureParameter(); overlay.name = "OverlayMap"; overlay.resourcePath = "res:/graphics/test/piece_os.dds";
  const intensity = new Tr2FloatParameter(); intensity.name = "MaterialDiffuseIntensity"; intensity.value = 0.5;
  material.parameters.set("OverlayMap", overlay).set("MaterialDiffuseIntensity", intensity);

  const effect = material.CreateEffect();
  assert.equal(effect.constructor, Tr2Effect);
  assert.equal(effect.name, "IncarnaSimple_Shadow");
  assert.deepEqual([ ...effect.resources ], [ overlay ], "textures go to resources");
  assert.deepEqual([ ...effect.parameters ], [ intensity ], "constants go to parameters");
  assert.equal(material.parameters.size, 0, "the parameters moved, so the material is spent");

  await settled();
  // The source names the file, not the material's name: no shader uses
  // incarnasimple_shadow.fxt.
  assert.equal(effect.GetEffectPathName(), "res:/graphics/shaders/compiled/dx11/incarnadetailed_shadow.fxt");
  assert.equal(Tr2ShaderMaterial.compiledEffectPath("res:/graphics/shaders/Visualizers/LightPrePassNormals.fx"),
    "res:/graphics/shaders/compiled/dx11/lightprepassnormals.fxt", "the source's folder is dropped");
});

test("initializing a read static puts in each area the effect its material becomes", async t =>
{
  renderSetup(t);
  blue.resMan = new LibraryResMan(libraryNaming("IncarnaDetailed", "res:/graphics/shaders/IncarnaDetailed.fx"));
  const root = readBlack(walkwayRecord());

  const effect = root.detailMeshes[0].opaquePrepassAreas[0].effect;
  assert.equal(effect.constructor, Tr2Effect);
  assert.deepEqual([ ...effect.resources ].map(parameter => parameter.name), [ "OverlayMap" ]);
  assert.deepEqual([ ...effect.parameters ].map(parameter => parameter.name), [ "ShadowTransparency" ]);
  await settled();
  assert.equal(effect.GetEffectPathName(), "res:/graphics/shaders/compiled/dx11/incarnadetailed.fxt");
});

test("once the shader library is loaded, a read static's effects hold their paths at once", async t =>
{
  renderSetup(t);
  blue.resMan = new LibraryResMan(libraryNaming("IncarnaDetailed", "res:/graphics/shaders/IncarnaDetailed.fx"));
  const library = await Tr2ShaderMaterial.loadShaderLibrary(blue.resMan);
  assert.equal(await Tr2ShaderMaterial.loadShaderLibrary(blue.resMan), library, "loaded once per manager");

  const root = readBlack(walkwayRecord());
  const effect = root.detailMeshes[0].opaquePrepassAreas[0].effect;
  assert.equal(effect.GetEffectPathName(), "res:/graphics/shaders/compiled/dx11/incarnadetailed.fxt");
  assert.equal(blue.resMan.requests.filter(request => request.path === Tr2ShaderMaterial.shaderLibraryPath).length, 1);
});

/** A test manager whose LoadObject answers with a shader library. */
class LibraryResMan extends StubResMan
{
  constructor(library)
  {
    super();
    this.library = library;
  }

  LoadObject(path)
  {
    this.requests.push({ path, load: true });
    return Promise.resolve(path === Tr2ShaderMaterial.shaderLibraryPath ? this.library : null);
  }
}

function libraryNaming(name, shaderPath)
{
  const shader = new Tr2HighLevelShader();
  shader.name = name;
  shader.shaderPath = shaderPath;
  const library = new Tr2ShaderManager();
  library.shaderLibrary = [ shader ];
  return library;
}

function settled()
{
  return new Promise(resolve => setImmediate(resolve));
}

/**
 * Installs a stub render context and resource manager. `geometries` maps a
 * path to the resource GetResource answers with; without it the stub answers
 * every path with a fresh resource of its kind.
 */
function renderSetup(t, geometries = null)
{
  const context = Tr2RenderContext_GetMainThreadRenderContext(), oldAL = context.GetRenderContextAL(), oldManager = blue.resMan;
  const oldView = Tr2Renderer.GetViewTransform().slice();
  const al = new Tr2RenderContextALStub(); al.CreateDevice(); al.BeginScene(); context.SetRenderContextAL(al);
  blue.resMan = new StubResMan(geometries ? path => geometries[path] ?? null : null); Tr2Renderer.SetViewTransform(mat4.create());
  const scenes = [];
  t.after(() =>
  {
    for (const scene of scenes) scene.Destruct();
    SharedGeometryBuffer(context).ReleaseResources(); context.SetRenderContextAL(oldAL); blue.resMan = oldManager;
    Tr2Renderer.SetViewTransform(oldView); al.Destroy();
  });
  const shader = { GetTechniqueIndex: () => 0, GetPassCount: () => 1, GetShaderTypeMask: () => 3, ApplyAllStateForPass() {} };
  const material = { GetShaderStateInterface: () => shader, IsGood: () => true, ApplyMaterialDataForPass() {} };
  return { context, material, scene: () => { const scene = new Tr2InteriorScene(); scenes.push(scene); return scene; } };
}

function staticWith(meshes)
{
  const value = new Tr2InteriorStatic();
  value.detailMeshes = meshes;
  return value;
}

function mesh(x)
{
  const resource = new TriGeometryRes();
  resource.ReadCMFFile({ meshes: [ {
    bounds: { min: [ x, -1, -1 ], max: [ x + 2, 1, 1 ] },
    decl: [ { usage: "Position", usageIndex: 0, type: "Float32", elementCount: 3, offset: 0 } ],
    vertex: { position: [ x, 0, 0, x + 2, 0, 0, x, 1, 0 ] },
    indices: [ { faces: [ 0, 1, 2 ] } ], areas: [ { firstElement: 0, elementCount: 1 } ]
  } ] });
  prepareResourceFixture(resource);
  const value = new Tr2Mesh();
  value.SetGeometryRes(resource);
  return value;
}

/** A prepared geometry with one mesh per x, each spanning [x, x + 2] by [-1, 1] by [-1, 1]. */
function geometryOf(xs)
{
  const resource = new TriGeometryRes();
  resource.ReadCMFFile({ meshes: xs.map(x => ({
    bounds: { min: [ x, -1, -1 ], max: [ x + 2, 1, 1 ] },
    decl: [ { usage: "Position", usageIndex: 0, type: "Float32", elementCount: 3, offset: 0 } ],
    vertex: { position: [ x, 0, 0, x + 2, 0, 0, x, 1, 0 ] },
    indices: [ { faces: [ 0, 1, 2 ] } ], areas: [ { firstElement: 0, elementCount: 1 } ]
  })) });
  prepareResourceFixture(resource);
  return resource;
}

function area(material)
{
  const value = new Tr2MeshArea();
  value.SetMaterial(material);
  return value;
}

function batchesOf(value, type)
{
  const accumulator = new TriRenderBatchAccumulator().SetTriPoolAllocator(new TriPoolAllocator().RegisterCatalog());
  const committed = [];
  const commit = accumulator.Commit.bind(accumulator);
  accumulator.Commit = batch => { committed.push(batch); return commit(batch); };
  value.GetBatches(accumulator, type, value.GetPerObjectData(accumulator));
  return committed;
}

function assertClose(actual, expected)
{
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < expected.length; i++) assert.ok(Math.abs(actual[i] - expected[i]) < 1e-5, `element ${i}: ${actual[i]} vs ${expected[i]}`);
}

class BlackFixture
{
  strings = [];
  String(value)
  {
    let index = this.strings.indexOf(value);
    if (index === -1) { index = this.strings.length; this.strings.push(value); }
    return u16(index);
  }
  Object(id, kind, fields)
  {
    const parts = [ this.String(kind) ];
    for (const [ name, value ] of fields) parts.push(concat([ this.String(name), value ]));
    const body = concat(parts);
    return concat([ u32(id), u32(body.length), body ]);
  }
  Finish(root)
  {
    const narrow = [ u16(this.strings.length) ];
    for (const value of this.strings) narrow.push(concat([ new TextEncoder().encode(value), new Uint8Array(1) ]));
    const strings = concat(narrow), wide = u16(0);
    return concat([ u32(0xb1acf11e), u32(1), u32(strings.length), strings, u32(wide.length), wide, root ]);
  }
}

function concat(parts)
{
  const bytes = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  return bytes;
}

function u16(value)
{
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function u32(value)
{
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
}

function f32(value)
{
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setFloat32(0, value, true);
  return bytes;
}
