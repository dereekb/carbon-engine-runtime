import assert from "node:assert/strict";
import test from "node:test";
import { CjsPaperDollCompositor, CjsPaperDollCompositionTarget, CjsPaperDollMaterialLayer } from "../../../npm/dist/character/index.js";
import { Tr2HostBitmap, Tr2Renderer, Tr2RenderContext_GetMainThreadRenderContext } from "../../../npm/dist/trinity/index.js";
import { RealizeTexture } from "../../../npm/dist/trinity/core/Tr2ImageIOHelpers.js";
import { Tr2RenderContextALStub } from "../../../npm/dist/trinityal/index.js";
import { PixelFormat } from "../../../npm/dist/global/consts/renderContext/index.js";

const build = { CheckActive() {}, Ready: value => value };

function stubContext(t)
{
    const context = Tr2RenderContext_GetMainThreadRenderContext(), oldAL = context.GetRenderContextAL();
    const al = new Tr2RenderContextALStub();
    al.CreateDevice();
    context.SetRenderContextAL(al);
    t.after(() => { context.SetRenderContextAL(oldAL); al.Destroy(); });
    return context;
}

test("the compositor's region statics: cutout, bounds and a rounded viewport", () =>
{
    assert.deepEqual(Array.from(CjsPaperDollCompositor.full), [ 0, 0, 1, 1 ]);
    assert.deepEqual(Array.from(CjsPaperDollCompositor.clear), [ 0, 0, 0, 0 ]);
    assert.deepEqual(Array.from(CjsPaperDollCompositor.crop({ cutoutX: .25, cutoutY: .5, cutoutWidth: .5, cutoutHeight: .25 })), [ .25, .5, .5, .25 ]);
    assert.deepEqual(Array.from(CjsPaperDollCompositor.bounds([ .25, .5, .5, .25 ])), [ .25, .5, .75, .75 ]);
    // Both edges round, so two adjacent regions meet without a gap or overlap.
    const left = CjsPaperDollCompositor.viewport(1000, 100, [ 0, 0, .3333, 1 ]);
    const right = CjsPaperDollCompositor.viewport(1000, 100, [ .3333, 0, .6667, 1 ]);
    assert.equal(left.x + left.width, right.x);
    assert.deepEqual(right, { x: 333, y: 0, width: 667, height: 100, minZ: 0, maxZ: 1 });
});

test("a material layer draws its pattern for a patterned palette, else its diffuse with the selection's colours", () =>
{
    const writes = [];
    const diffuse = { SetParameter__Vector4: (name, value) => writes.push([ name, Array.from(value) ]) };
    const pattern = {};
    const layer = new CjsPaperDollMaterialLayer();
    layer.DiffuseMap = { effect: diffuse, region: CjsPaperDollCompositor.full };
    layer.patterns.set("res:/patterned.color", pattern);
    const colors = [ [ 1, 0, 0, 1 ], [ 0, 1, 0, 1 ], [ 0, 0, 1, 1 ] ];
    assert.equal(layer.DiffuseFor({ palette: "res:/patterned.color", colors }), pattern);
    assert.equal(layer.DiffuseFor({ palette: "res:/plain.color", colors }), diffuse);
    assert.deepEqual(writes, [], "a plain (not colourised) diffuse keeps its own colours");
    layer.colourised = true;
    layer.DiffuseFor({ palette: "res:/plain.color", colors });
    assert.deepEqual(writes, [ [ "Color1", [ 1, 0, 0, 1 ] ], [ "Color2", [ 0, 1, 0, 1 ] ], [ "Color3", [ 0, 0, 1, 1 ] ] ]);
});

test("the compositor makes, finishes and releases its targets; a composition target draws through it", t =>
{
    const context = stubContext(t);
    const compositor = new CjsPaperDollCompositor(context, build);
    const plain = compositor.MakeTarget(64, 32);
    const mipped = compositor.MakeTarget(64, 32, true);
    assert.deepEqual(compositor.targets, [ plain, mipped ]);
    // A mipped target is RGBA (Carbon generates no mips for BGR formats); the others BGRA.
    assert.equal(plain.GetFormat(), PixelFormat.PIXEL_FORMAT_B8G8R8A8_UNORM);
    assert.equal(mipped.GetFormat(), PixelFormat.PIXEL_FORMAT_R8G8B8A8_UNORM);
    assert.equal(mipped.GetMipCount(), 7);

    const target = compositor.TargetTexture(16, 8);
    assert.equal(target.constructor, CjsPaperDollCompositionTarget);
    assert.equal(compositor.targets.at(-1), target.target);
    assert.equal(target.width, 16);
    const draws = [];
    compositor.Draw = (...args) => draws.push(args);
    target.Draw("effect", CjsPaperDollCompositor.full, true);
    assert.deepEqual(draws, [ [ target.target, 16, 8, "effect", CjsPaperDollCompositor.full, true, true ] ]);

    compositor.Destruct();
    assert.deepEqual(compositor.targets, []);
    assert.deepEqual(compositor.effects, []);
    compositor.Destruct();
});

test("the compositor's encoding flags follow the source's channel count", t =>
{
    const compositor = new CjsPaperDollCompositor(stubContext(t), build);
    assert.deepEqual(compositor._Flags({ format: PixelFormat.PIXEL_FORMAT_R8_UNORM }, "texture"), { texture_L8: 1, texture_L8A8: 0 });
    assert.deepEqual(compositor._Flags({ format: PixelFormat.PIXEL_FORMAT_R8G8_UNORM }, "zonemap"), { zonemap_L8: 0, zonemap_L8A8: 1 });
    assert.deepEqual(compositor._Flags({ format: PixelFormat.PIXEL_FORMAT_B8G8R8A8_UNORM }, "detailmap"), { detailmap_L8: 0, detailmap_L8A8: 0 });
    compositor.Destruct();
});

/** A material with selected reflection and the same resource parameter interface as Tr2Effect. */
function material(resources, srgb = [ "DiffuseMap", "SpecularMap" ])
{
    const parameters = Object.fromEntries(Object.entries(resources).map(([ name, resource ]) => [ name, {
        resource, GetResource() { return this.resource; }, SetResource(value) { this.resource = value; }
    } ]));
    const options = { QUALITY: "selected" };
    return {
        options, resources: Object.values(parameters), GetResourceByName: name => parameters[name] || null,
        effectResource: { GetShader(selected)
        {
            assert.equal(selected, options);
            return { GetResource: name => ({ isSRGB: srgb.includes(name) }) };
        } }
    };
}

test("publication uses selected reflection only for owned diffuse/specular and shares one readback per target", async t =>
{
    const compositor = new CjsPaperDollCompositor(stubContext(t), build);
    t.after(() => compositor.Destruct());
    const colour = compositor.TargetTexture(4, 2, true);
    const normal = compositor.TargetTexture(4, 2);
    const external = {};
    const first = material({ DiffuseMap: colour.resource, SpecularMap: colour.resource, NormalMap: normal.resource }, [ "DiffuseMap", "SpecularMap", "NormalMap" ]);
    const second = material({ DiffuseMap: colour.resource, SpecularMap: external }, []);
    let reads = 0;
    const copy = Tr2HostBitmap.prototype.CopyFromRenderTarget;
    Tr2HostBitmap.prototype.CopyFromRenderTarget = function (...args) { ++reads; return copy.apply(this, args); };
    t.after(() => { Tr2HostBitmap.prototype.CopyFromRenderTarget = copy; });

    const prepared = await compositor.PublishMaterials([ first, second ]);
    assert.equal(reads, 1);
    assert.equal(prepared.bindings.size, 2);
    const diffuse = first.GetResourceByName("DiffuseMap"), specular = first.GetResourceByName("SpecularMap");
    const published = prepared.bindings.get(diffuse);
    assert.equal(published, prepared.bindings.get(specular));
    assert.equal(published.format, PixelFormat.PIXEL_FORMAT_R8G8B8A8_UNORM_SRGB);
    assert.equal(published.GetBitmap().GetMipCount(), 3);
    assert.equal(RealizeTexture(published, compositor._context).GetFormat(), PixelFormat.PIXEL_FORMAT_R8G8B8A8_UNORM_SRGB);
    assert.equal(diffuse.GetResource(), colour.resource, "preparation cannot change a bound material");
    for (const [ parameter, resource ] of prepared.bindings) parameter.SetResource(resource);
    prepared.complete(true);
    assert.equal(normal.resource.GetTexture().GetFormat(), PixelFormat.PIXEL_FORMAT_B8G8R8A8_UNORM);
    assert.equal(colour.target.GetFormat(), PixelFormat.PIXEL_FORMAT_R8G8B8A8_UNORM);

    const reused = await compositor.PublishMaterials([ first, second ]);
    assert.equal(reused.bindings.get(diffuse), published);
    assert.equal(reads, 1, "unchanged publication needs no repeated readback");
    reused.complete(true);

    compositor.blitter.Draw__Effect = () => true;
    for (const name of [ "BeginFrame", "BeginRenderContext", "EndRenderContext", "EndFrame" ])
    {
        const original = Tr2Renderer[name];
        Tr2Renderer[name] = () => {};
        t.after(() => { Tr2Renderer[name] = original; });
    }
    colour.Draw({}, CjsPaperDollCompositor.full, true);
    const replacement = await compositor.PublishMaterials([ first ]);
    assert.equal(reads, 2);
    assert.notEqual(replacement.bindings.get(diffuse), published);
    assert.ok(published.GetBitmap().IsValid(), "the previous generation survives pending publication");
    const discarded = replacement.bindings.get(diffuse);
    replacement.complete(false);
    assert.equal(discarded.GetBitmap(), null);
    assert.ok(published.GetBitmap().IsValid(), "discard keeps the completed generation");

    const accepted = await compositor.PublishMaterials([ first ]);
    for (const [ parameter, resource ] of accepted.bindings) parameter.SetResource(resource);
    accepted.complete(true);
    accepted.complete(true);
    assert.equal(published.GetBitmap(), null, "accepted replacement releases the previous bytes");
});

test("publication rejects missing reflection and disposes retained readback handles on failure or closure", async t =>
{
    const compositor = new CjsPaperDollCompositor(stubContext(t), build);
    t.after(() => compositor.Destruct());
    const target = compositor.TargetTexture(2, 2);
    const effect = material({ DiffuseMap: target.resource });
    const resource = effect.effectResource;
    effect.effectResource = null;
    await assert.rejects(compositor.PublishMaterials([ effect ]), /reflection is not ready/);
    effect.effectResource = resource;
    let retained = null;
    const copy = Tr2HostBitmap.prototype.CopyFromRenderTarget;
    Tr2HostBitmap.prototype.CopyFromRenderTarget = async function (source)
    {
        retained = source;
        compositor.Destruct();
        assert.equal(source.IsValid(), true, "readback retains the AL value after the target is closed");
        return true;
    };
    t.after(() => { Tr2HostBitmap.prototype.CopyFromRenderTarget = copy; });
    await assert.rejects(compositor.PublishMaterials([ effect ]), /changed during sRGB publication/);
    assert.equal(retained.IsValid(), false, "the retained value is released even when the build closes");
    assert.equal(compositor._publications.size, 0);
});
