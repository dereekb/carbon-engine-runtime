// Production classes read by BlackReader: a hand-written scene that exercises the registered production
// declarations, and, when a local client cache is given, real files (no game bytes are committed).
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import "../../npm/dist/trinity/index.js";
import "../../npm/dist/sof/index.js";
import { CjsSchema } from "../../npm/dist/blue/schema/CjsSchema.js";
import { Fixture, concat, floats, i32, u16, u32 } from "../support/blackFixture.js";
import { readBlack } from "../support/blackReader.js";

const EveSpaceScene = CjsSchema.getConstructor("EveSpaceScene");
const Tr2Effect = CjsSchema.getConstructor("Tr2Effect");
const TriTextureParameter = CjsSchema.getConstructor("TriTextureParameter");

/** No production object initializes during these reads, apart from the volumetrics effects Carbon's constructor loads. */
function forbidInitialization(context)
{
  for (const Constructor of [ EveSpaceScene, Tr2Effect, TriTextureParameter ])
  {
    context.mock.method(Constructor.prototype, "Initialize", function ()
    {
      // Tr2VolumetricsRenderer.cpp:21-45, 51-66, 119-120.
      if (Constructor === Tr2Effect && [ "VolumeBlit", "DownsampleDepth", "BlurVolumetric", "Fog/CalculateFroxels",
        "Fog/RtCalculateFroxels", "Fog/FilterFroxels", "Fog/RaymarchFroxels", "Fog/ApplyFroxels", "Fog/UpdateMieEnvironmentMap" ]
        .some(name => this.effectFilePath === `res:/Graphics/Effect/Managed/Space/SpecialFX/Volumetric/${name}.fx`)) return;
      assert.fail("a structural read must not initialize production objects");
    });
  }
}

/** Independently written bytes: a scene with a background effect, five constants and four textures. */
function authoredScene()
{
  const f = new Fixture();
  const parameters = [ u32(5), u16(24) ];
  for (let i = 0; i < 5; i++) parameters.push(concat([ f.S(`AuthoredParameter${i}`), new Uint8Array(6), floats([ i, i + .25, i + .5, 1 ]) ]));
  const textures = [];
  for (let i = 0; i < 4; i++)
  {
    textures.push(f.Object(i + 3, "TriTextureParameter", [ [ "name", f.S(`AuthoredTexture${i}`) ], [ "resourcePath", f.S(`res:/authored/texture${i}.dds`) ] ]));
  }
  const effect = f.Object(2, "Tr2Effect", [
    [ "effectFilePath", f.S("res:/authored/effect.fx") ], [ "constParameters", concat(parameters) ], [ "resources", f.List(textures) ]
  ]);
  return f.Finish(f.Object(1, "EveSpaceScene", [
    [ "backgroundEffect", effect ], [ "backgroundRenderingEnabled", new Uint8Array([ 1 ]) ],
    [ "ambientColor", floats([ .1, .2, .3, 1 ]) ], [ "fogStart", floats([ 5 ]) ], [ "fogEnd", floats([ 25 ]) ], [ "reflectionIntensity", floats([ .5 ]) ]
  ]));
}

/** The scene's structure, whatever bytes it came from. */
function verify(bytes)
{
  const scene = readBlack(bytes, { initialize: false });
  assert.equal(scene.constructor, EveSpaceScene);
  const effect = scene.backgroundEffect;
  assert.equal(effect.constructor, Tr2Effect);
  assert.equal(effect.resources.length, 4);
  assert.ok(Array.from(effect.resources).every(texture => texture.constructor === TriTextureParameter));
  assert.equal(new Set(effect.resources).size, 4);
  assert.equal(effect.constParameters.length, 5);
  assert.ok(scene.ambientColor instanceof Float32Array);
  return scene;
}

test("the registered production scene reads without initialization", context =>
{
  forbidInitialization(context);
  const fresh = new EveSpaceScene();
  const scene = verify(authoredScene());
  assert.equal(scene.backgroundRenderingEnabled, true);
  assert.equal(scene.fogStart, 5);
  assert.equal(scene.fogEnd, 25);
  assert.equal(scene.reflectionIntensity, .5);
  assert.deepEqual([ ...scene.ambientColor ], [ ...new Float32Array([ .1, .2, .3, 1 ]) ]);
  assert.equal(scene.ambientColor.constructor, fresh.ambientColor.constructor, "the scene's own vector is filled");
  const effect = scene.backgroundEffect;
  assert.equal(effect.effectFilePath, "res:/authored/effect.fx");
  for (let i = 0; i < 5; i++)
  {
    assert.equal(effect.constParameters[i].name, `AuthoredParameter${i}`);
    assert.deepEqual(Array.from(effect.constParameters[i].value), [ i, i + .25, i + .5, 1 ]);
  }
  for (let i = 0; i < 4; i++)
  {
    assert.equal(effect.resources[i].name, `AuthoredTexture${i}`);
    assert.equal(effect.resources[i].resourcePath, `res:/authored/texture${i}.dds`);
  }
});

const cube = process.env.CJS_BLACK_CANONICAL_CUBE;
test("a captured cube reads with the production declarations", { skip: cube ? false : "Set CJS_BLACK_CANONICAL_CUBE to a local m05_cube.black." }, context =>
{
  forbidInitialization(context);
  const bytes = readFileSync(cube);
  assert.equal(bytes.length, 1062);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), "a817beefa07ba8623c08a04e22545eeb0652dbc68ab19bd4542ab78f96314e9d");
  verify(bytes);
});

// Files of the build 3503375 cache, by stored name: six struct families with records.
const corpus = process.env.CJS_BLACK_STRUCT_CORPUS_DIR;
const cases = [
  [ "Tr2CurveScalarKey", "11/119f400e626e4e28_7c4b330b47c23cee3505a9d8cd495b58", 760,
    "632d3f3c03026a78d794d6519423fc1a7a120ea0a4e349f794bc62be7a67a6e2", 5, "value", .5 ],
  [ "Tr2ConstantEffectParameter", "23/239c7988b27b7d47_0cc28327a33385b16c42365fcba7deec", 4107,
    "5eb86d18c1c525a9e09d7fa9beb67744bc0bfaf50345f296571d69ce369b3b18", 2, "name", "DiffuseColor" ],
  [ "Tr2ShaderOption", "82/82944ceeb7961003_b44af3868f5e44d0cbea39ea51e13604", 12480,
    "b3d8334813ecda1fed5490dc6a68262730d2db95a31e7724d93ca88cf3e92d34", 4, "value", "REGULAR" ],
  [ "Tr2SamplerOverride", "25/25495c70c6958a45_137fde1e3cf4b1dcb786e02281c011e4", 47978,
    "f4d863c4a374d51108390f6559d380d00d996cb2ac2419b679da7bfca3af6a9d", 1, "name", "DiffuseMapSampler" ],
  [ "Locator", "c2/c2bbe7c2e400058e_96093b35491cd5533757a276defd0c93", 44479,
    "1704e7dd32c2dd527e225f91a31871373e7666489824fe93a8fe61f368671200", 19, "partTag", 0 ],
  [ "EveSofDataMeshInstance", "35/350cf81f2f26b64b_a800b64240ea16a7efba1d1b96df3365", 184126948,
    "b888ce85f9040a49e2cfff6357e9e7ab89905818562562c7ec06e786b165afec", 429, "boneIndex", 0 ]
];

/** The first non-empty array in the graph whose items are of the registered class, depth first. */
function firstListOf(root, className)
{
  const seen = new Set(), stack = [ root ];
  while (stack.length)
  {
    const value = stack.pop();
    if (value === null || typeof value !== "object" || seen.has(value) || ArrayBuffer.isView(value)) continue;
    seen.add(value);
    if (Array.isArray(value) && value.length && value.every(item => item && CjsSchema.getClassName(item.constructor) === className)) return value;
    for (const key of Object.keys(value)) stack.push(value[key]);
  }
  return null;
}

for (const [ family, path, size, sha256, count, member, expected ] of cases)
{
  test(`a real file reads its ${family} records`, { skip: corpus ? false : "Set CJS_BLACK_STRUCT_CORPUS_DIR to a local ResFiles cache." }, () =>
  {
    const bytes = readFileSync(join(corpus, path));
    assert.equal(bytes.length, size);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), sha256);
    const records = firstListOf(readBlack(bytes, { initialize: false }), family);
    assert.equal(records?.length, count);
    assert.equal(records[0][member], expected);
  });
}
