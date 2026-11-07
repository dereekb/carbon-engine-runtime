import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { CjsGraph } from "../../src/global/model/graph/index.js";
import { CjsSchema } from "../../npm/dist/blue/schema/CjsSchema.js";
import { CjsBlackReader } from "../../npm/dist/blue/formats/black/core/CjsBlackReader.js";
import { blue } from "../../npm/dist/blue/blue.js";
import "../../npm/dist/trinity/index.js";
import "../../npm/dist/audio/index.js";
import "../../npm/dist/sof/index.js";
import { EveSpaceScene } from "../../npm/dist/trinity/eve/scene/EveSpaceScene.js";
import { Tr2Mesh } from "../../npm/dist/trinity/core/mesh/Tr2Mesh.js";
import { Tr2InstancedMesh } from "../../npm/dist/trinity/core/mesh/Tr2InstancedMesh.js";
import { EveTrailsSet } from "../../npm/dist/trinity/eve/attachment/booster/EveTrailsSet.js";
import { Tr2Light } from "../../npm/dist/trinity/eve/lights/Tr2Light.js";
import { Tr2Effect } from "../../npm/dist/trinity/shader/Tr2Effect.js";
import { TriTextureParameter } from "../../npm/dist/trinity/shader/parameter/TriTextureParameter.js";
import { TriGeometryRes } from "../../npm/dist/trinity/resources/geometry/TriGeometryRes.js";
import { TriTextureRes } from "../../npm/dist/trinity/resources/texture/TriTextureRes.js";
import { Tr2EffectRes } from "../../npm/dist/trinity/shader/Tr2EffectRes.js";
import { Tr2LightProfileRes } from "../../npm/dist/trinity/resources/Tr2LightProfileRes.js";

// External build-3569502 corpus, acquired through tools-core. No asset bytes are committed.
// Ships are tools-core SOF output, not authored Black files:
// /eve/3569502/sof/dna/{mf4_t1:minmatarbase:minmatar,cf2_t1:caldaribase:caldari,ac1_t1:amarrbase:amarr}.
// Black assets: dx9/scene/universe/a01_cube.black,
// fisfx/explosion/ecx_generic_explosive_01a.black, dx9/model/turret/launcher/light/light_missile.black.
const corpus = process.env.CJS_GRAPH_POPULATED_CORPUS;
const fixtures = [
    ["environment.black", "262d7ed669488bb23d7761a079b2866fa197d994c76c49357ace37dbf800ae51"],
    ["rifter.json", "fd0b029e5ca245dc89f348300512468edc5c5835a607f91fc015444686626394"],
    ["merlin.json", "54a1997cd0a67bc8ec4dd24c739b2093c3543ad649c3849e1371cac7da234f62"],
    ["omen.json", "33252ace2d30ba3eb6d4940fdede5dc3b4ed49ef326749f71d8df727915d81da"],
    ["explosion.black", "72df28e62ffd4596f4b12eff1fc728ef29f2b5aeb4c276525c8bd0480febb474"],
    ["missile.black", "c87e3a53d250ea4f2a7733de25b4d3c6e117cd5fb12083f920557ab340e5baa6"]
];
const objectKinds = new Set(["root", "rootRef", "object", "rawStruct"]);
const listKinds = new Set(["list", "structList"]);
const resourceClasses = new Set([TriGeometryRes, TriTextureRes, Tr2EffectRes, Tr2LightProfileRes]);

/** Returns persistent storage declarations only; no runtime services enter the authored inventory. */
function persisted(ctor)
{
    const members = new Map();
    // Schema retains derived-to-base declarations. Collapse identical eligible storage
    // rows only; different storage under the same name needs explicit adapter review.
    for (const member of CjsSchema.getSchema(ctor).members)
    {
        if (member.type?.runtimeOnly || !(member.edit?.persist || member.edit?.persistOnly)) continue;
        const prior = members.get(member.name);
        if (prior)
        {
            assert.equal(member.key, prior.key);
            assert.equal(member.index, prior.index);
            assert.deepEqual(member.type, prior.type);
        }
        else members.set(member.name, member);
    }
    return [...members.values()];
}

/** Independent schema walk; fails on unknown containers instead of quietly dropping them. */
function inventory(root)
{
    const objects = new Map(), family = new Set(), stack = [[root, null]], unreviewedPaths = new Set();
    while (stack.length)
    {
        const [object, declared] = stack.pop();
        if (object === null || objects.has(object)) continue;
        assert.equal(typeof object, "object");
        const prototype = Object.getPrototypeOf(object);
        const ctor = prototype === Object.prototype || prototype === null
            ? CjsSchema.getConstructor(declared) : prototype.constructor;
        assert.ok(ctor, `unresolved struct: ${declared}`);
        objects.set(object, ctor);
        family.add(ctor);

        for (const member of persisted(ctor))
        {
            const own = Object.getOwnPropertyDescriptor(object, member.key);
            assert.ok(own && Object.hasOwn(own, "value"), `${CjsSchema.getClassName(ctor)}.${member.name} must be stored data`);
            const value = member.index === undefined ? own.value : own.value[member.index];
            if (value && (member.type.kind === "path" || member.type.kind === "wpath"))
            {
                // External object graphs are intentionally not expanded by no-init hydration.
                const name = CjsSchema.getClassName(ctor);
                const external = (name === "EveChildRef" && member.key === "resPath")
                    || (name === "Tr2ControllerReference" && member.key === "path");
                // Current EveSpaceScene declares these alternate paths but never acquires them.
                const unusedAlternate = ctor === EveSpaceScene
                    && ["lowQualityNebulaResPath", "lowQualityNebulaMixResPath"].includes(member.key);
                if (!external && !unusedAlternate && !resourceSlots(ctor).some(([, , pathKey]) => pathKey === member.key))
                    unreviewedPaths.add(`${name}.${member.name}`);
            }
            if (objectKinds.has(member.type.kind)) stack.push([value, member.type.className]);
            else if (listKinds.has(member.type.kind))
            {
                assert.ok(Array.isArray(value));
                for (const child of value) stack.push([child, member.type.className ?? member.type.itemType]);
            }
            else if (member.type.kind === "array")
            {
                // These are value arrays, not object edges. The decal's current schema says
                // unknown; SetIndices/GetIndices explicitly implement per-LOD triangle indices.
                assert.ok(Array.isArray(value));
                if (CjsSchema.getClassName(ctor) === "EveSpaceObjectDecal" && member.name === "staticIndexBuffers")
                {
                    for (const lod of value) assert.ok(Array.isArray(lod) && lod.every(Number.isInteger));
                }
                else
                {
                    assert.equal(member.type.itemType, "mat4", "unreviewed array element type");
                    for (const matrix of value) assert.ok(ArrayBuffer.isView(matrix) && matrix.length === 16);
                }
            }
            else assert.ok(value === null || typeof value !== "object" || ArrayBuffer.isView(value),
                `unreviewed value: ${CjsSchema.getClassName(ctor)}.${member.name}`);
        }
    }
    assert.equal(unreviewedPaths.size, 0, `unreviewed nonempty resource paths: ${[...unreviewedPaths].join(", ")}`);
    return { objects, family };
}

/** Explicit runtime slots from their owning implementations; assigned instance providers stay authored edges. */
function resourceSlots(ctor)
{
    const slots = [];
    if (ctor === EveSpaceScene)
    {
        for (const index of [1, 2, 3]) slots.push([`envMap${index}`, TriTextureRes, `envMap${index}ResPath`]);
        slots.push(["_envMapTextureRes", TriTextureRes, "envMapResPath"], ["_staticEnvMapTextureRes", TriTextureRes, "envMapResPath"]);
    }
    if (ctor === Tr2Mesh || Tr2Mesh.prototype.isPrototypeOf(ctor.prototype))
        slots.push(["_geometry", TriGeometryRes, "geometryResPath"], ["_lowResGeometry", TriGeometryRes, null]);
    if (ctor === Tr2InstancedMesh) slots.push(["_loadedGeometryResource", TriGeometryRes, "instanceGeometryResPath"]);
    if (ctor === EveTrailsSet) slots.push(["_geometryResource", TriGeometryRes, "geometryResPath"]);
    // Attachment records hold profiles but currently do not acquire them themselves.
    const attachmentLight = ["EveBannerLight", "EveHazeSetLight", "EveSpotlightLight"].includes(CjsSchema.getClassName(ctor));
    if (ctor === Tr2Light || Tr2Light.prototype.isPrototypeOf(ctor.prototype) || attachmentLight)
        slots.push(["lightProfile", Tr2LightProfileRes, "lightProfilePath", "lp"]);
    if (ctor === Tr2Effect) slots.push(["_effectResource", Tr2EffectRes, "effectFilePath"]);
    if (ctor === TriTextureParameter)
        slots.push(["resource", TriTextureRes, "resourcePath"], ["_lowResResource", TriTextureRes, null]);
    return slots;
}

/** Bounded traversal-only adapter, not the future production Blue adapter or value handlers. */
function registerFamily(family)
{
    const known = new Map([...family].map(ctor => [CjsSchema.getClassName(ctor), ctor]));
    for (const ctor of family)
    {
        const members = persisted(ctor).map(member =>
        {
            const type = member.type, collection = listKinds.has(type.kind), object = objectKinds.has(type.kind);
            const childType = collection ? type.className ?? type.itemType : type.className;
            return {
                name: member.name, key: member.key, index: member.index,
                type: collection ? "list" : object ? "rootRef" : undefined,
                edge: collection || object ? {
                    kind: type.kind === "rawStruct" || type.kind === "structList" ? "embed" : "ref",
                    collection, type: known.get(childType) ?? null
                } : null
            };
        });
        for (const [name, type] of resourceSlots(ctor))
            members.push({ name, type: "rootRef", edge: { kind: "ref", type } });
        CjsGraph.define(ctor, { name: CjsSchema.getClassName(ctor), members });
    }
    for (const ctor of resourceClasses) CjsGraph.define(ctor, { name: CjsSchema.getClassName(ctor), members: [] });
}

/** Hydrates a fresh instance on every call; no initialization, animation, acquisition or GPU work. */
function hydrate(name, assets)
{
    const bytes = assets.get(name);
    if (name.endsWith(".json"))
    {
        const values = JSON.parse(bytes);
        return CjsSchema.from(values._type, values, { initialize: false, notify: false });
    }
    const reader = new CjsBlackReader(bytes, { schema: null, initialize: false });
    const root = reader.CreateObject();
    assert.deepEqual(reader.reports, []);
    assert.equal(reader.reader.AtEnd(), true);
    return root;
}

/** Stage unloaded handles, sharing by path and route (light profiles use ex:lp), without acquisition setters. */
function attachHandles(objects)
{
    const handles = new Map();
    let references = 0;
    for (const [object, ctor] of objects)
    {
        for (const [slot, resourceClass, pathKey, ex = ""] of resourceSlots(ctor))
        {
            assert.equal(object[slot], null, `${CjsSchema.getClassName(ctor)}.${slot} unexpectedly initialized`);
            if (pathKey === null || !object[pathKey]) continue;
            const path = object[pathKey];
            const key = `${ex}:${path}`;
            if (!handles.has(key))
            {
                const handle = new resourceClass();
                handle._path = path;
                handles.set(key, handle);
            }
            assert.equal(handles.get(key).constructor, resourceClass);
            object[slot] = handles.get(key);
            references++;
        }
    }
    return { handles, references };
}

/** Compare identities and encounter order without structural equality hiding duplicate resources. */
function sameIdentities(actual, expected)
{
    assert.equal(actual.length, expected.length);
    for (let i = 0; i < actual.length; i++) assert.equal(actual[i], expected[i]);
}

/** Alternating warmed batches; all fixture work and selection compilation precede the timer. */
function measure(scene, selection)
{
    const outputs = [[], []], options = [{ prune: false }, {}], samples = [[], []];
    const iterations = 30;
    for (let batch = 0; batch < 30; batch++)
    {
        for (let turn = 0; turn < 2; turn++)
        {
            const mode = (batch + turn) % 2, output = outputs[mode];
            const start = performance.now();
            for (let i = 0; i < iterations; i++)
            {
                output.length = 0;
                CjsGraph.select(scene, selection, output, options[mode]);
            }
            if (batch >= 10) samples[mode].push((performance.now() - start) / iterations);
        }
    }
    for (const sample of samples) sample.sort((a, b) => a - b);
    sameIdentities(outputs[0], outputs[1]);
    return { samples: 20, walksPerSample: iterations, fullMedianMs: (samples[0][9] + samples[0][10]) / 2,
        cachedMedianMs: (samples[1][9] + samples[1][10]) / 2 };
}

test("populated ship/effect graphs preserve full/cached resource identity and order", {
    skip: !corpus && "Set CJS_GRAPH_POPULATED_CORPUS to the external six-asset directory."
}, context =>
{
    context.mock.method(blue.resMan, "GetResource", () => { throw new Error("Unexpected resource acquisition"); });
    context.mock.method(blue.resMan, "LoadObject", () => { throw new Error("Unexpected object acquisition"); });
    context.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected network acquisition"); });
    const assets = new Map(fixtures.map(([name, hash]) =>
    {
        const bytes = readFileSync(join(corpus, name));
        assert.equal(createHash("sha256").update(bytes).digest("hex"), hash);
        return [name, bytes];
    }));

    for (const [copies, missiles] of [[1, 1], [4, 12], [10, 30]])
    {
        const scene = hydrate("environment.black", assets);
        for (let i = 0; i < copies; i++)
        {
            for (const name of ["rifter.json", "merlin.json", "omen.json", "explosion.black"])
                scene.objects.push(hydrate(name, assets));
        }
        for (let i = 0; i < missiles; i++) scene.objects.push(hydrate("missile.black", assets));
        const { objects, family } = inventory(scene);
        assert.ok(objects.size > 3800);
        assert.ok(family.size >= 63);
        registerFamily(family);

        const authored = new Set();
        assert.equal(CjsGraph.traverse(scene, object => { authored.add(object); }), objects.size);
        assert.equal(authored.size, objects.size);
        for (const object of objects.keys()) assert.ok(authored.has(object), "missing authored identity");
        const providers = [...objects].filter(([, ctor]) => ctor === Tr2InstancedMesh)
            .map(([object]) => [object, object._instanceGeometryResource]);
        const { handles, references } = attachHandles(objects);
        assert.ok(handles.size > 50, "resource comparison must be nonempty and diverse");
        for (const [object, provider] of providers) assert.equal(object._instanceGeometryResource, provider);
        const trailHandles = [...objects].filter(([object, ctor]) => ctor === EveTrailsSet && object._geometryResource).length;
        const profileHandles = [...handles.values()].filter(handle => handle.constructor === Tr2LightProfileRes).length;

        const start = performance.now();
        const selection = CjsGraph.compileSelection({ matchClass: info => resourceClasses.has(info.ctor) });
        const selectionCompileMsWithWarmClasses = performance.now() - start;
        const fullStats = {}, cachedStats = {};
        const full = CjsGraph.select(scene, selection, [], { prune: false, stats: fullStats });
        const cached = CjsGraph.select(scene, selection, [], { stats: cachedStats });
        sameIdentities(cached, full);
        const selected = new Set(full);
        assert.equal(selected.size, handles.size);
        assert.equal(full.length, handles.size);
        for (const handle of handles.values()) assert.ok(selected.has(handle), "missing resource identity");
        assert.equal(fullStats.visited, objects.size + handles.size);
        assert.equal(cachedStats.compiledClasses, 0);

        context.diagnostic(JSON.stringify({ ships: copies * 3, explosions: copies, missiles,
            authoredObjects: objects.size, authoredClasses: family.size, references, uniqueHandles: handles.size, trailHandles, profileHandles,
            fullVisited: fullStats.visited, cachedVisited: cachedStats.visited, selectionCompileMsWithWarmClasses,
            ...(process.env.CJS_GRAPH_SELECTION_BENCH ? measure(scene, selection) : {}) }));
    }
});
