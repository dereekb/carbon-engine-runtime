import assert from "node:assert/strict";
import test from "node:test";
import { CjsCmfFormat } from "../../../../../src/resource/formats/cmf/index.js";
import { CjsGr2Format } from "../../../../../src/resource/formats/gr2/index.js";

// A hull wreck's mesh paints its intact mask in the Granny member DiffuseColor0; quadwreckv5 reads it as COLOR0.
// A projection that drops it leaves the input unbound, and the wreck draws as char: flat black.

function triangle(color0)
{
    const vertex = {
        position: [ 0, 0, 0, 1, 0, 0, 0, 1, 0 ],
        texcoord0: [ 0, 0, 1, 0, 0, 1 ]
    };
    if (color0) vertex.color0 = color0;
    return {
        meshes: [ {
            name: "triangle",
            vertex,
            indices: [ { name: "hull", bytesPerIndex: 2, faces: [ 0, 1, 2 ] } ],
            boneBindings: [],
            morphTargets: []
        } ],
        skeletons: [],
        animations: []
    };
}

const COLOURS = [ 1, 0.5, 0, 1, 0.25, 0.75, 1, 0, 0, 0, 0, 1 ];

test("a gr2's DiffuseColor0 projects as color0 and declares a CMF Color element", () =>
{
    const bytes = CjsGr2Format.writeShared(triangle(COLOURS));
    const raw = CjsGr2Format.readRaw(bytes);
    assert.ok(raw.fileInfo.Meshes[0].PrimaryVertexData.Vertices.__type.some(item => item.name === "DiffuseColor0"));

    const shared = CjsGr2Format.read(bytes);
    const color0 = shared.meshes[0].vertex.color0;
    assert.equal(color0.length, COLOURS.length);
    color0.forEach((value, index) => assert.ok(Math.abs(value - COLOURS[index]) <= 1 / 255, `color0[${index}] ${value}`));

    const cmf = CjsCmfFormat.loadShared(shared);
    const elements = cmf.meshes[0].decl;
    assert.ok(elements.some(element => element.usage === "Color" && element.usageIndex === 0), JSON.stringify(elements));
});

test("a gr2 without a vertex colour projects no color0 and an unchanged CMF declaration", () =>
{
    const shared = CjsGr2Format.read(CjsGr2Format.writeShared(triangle(null)));
    const color0 = shared.meshes[0].vertex.color0;
    assert.ok(!color0 || color0.length === 0);

    const cmf = CjsCmfFormat.loadShared(shared);
    const elements = cmf.meshes[0].decl;
    assert.ok(elements.length > 0);
    assert.ok(!elements.some(element => element.usage === "Color"), JSON.stringify(elements));
});
