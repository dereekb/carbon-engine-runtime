import test from "node:test";
import assert from "node:assert/strict";
import { CjsWebglFormat } from "../../../../../src/resource/formats/webgl/index.js";
import { buildTwoSamplerPixelDxbc, buildContainer, opcodeToken } from "./synthetic.js";

function shader(opcode, u, v)
{
    const bytes = buildTwoSamplerPixelDxbc([0], [5]);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const chunk = view.getUint32(32, true);
    const tokens = Array.from(new Uint32Array(bytes.buffer, bytes.byteOffset + chunk + 8, view.getUint32(chunk + 4, true) / 4));
    let i = 2;
    while ((tokens[i] & 2047) !== 69) i += (tokens[i] >>> 24) & 127;
    const sample = tokens.slice(i + 1, i + 9);
    // sample_l adds one immediate scalar LOD operand.
    if (opcode === 72) sample.push(1 | (4 << 12), 0);
    tokens.splice(i, 9, (opcodeToken(opcode, sample.length + 2) | 0x80000000) >>> 0,
        1 | ((u & 15) << 9) | ((v & 15) << 13), ...sample);
    tokens[1] = tokens.length;
    return buildContainer([{fourCC: "SHEX", payload: new Uint8Array(new Uint32Array(tokens).buffer)}]);
}

for (const [u, v] of [[0,-1],[-1,0],[1,0],[0,1]])
{
    test(`explicit LOD sample preserves neighbour offset ${u},${v}`, () =>
    {
        const {source} = CjsWebglFormat.emitGlsl(shader(72, u, v));
        assert.ok(source.includes(`textureLodOffset(s5, vec2(r0.xy), 0.0, ivec2(${u}, ${v}))`));
    });
}
test("implicit sample preserves signed offsets", () =>
{
    const {source} = CjsWebglFormat.emitGlsl(shader(69, -2, 3));
    assert.ok(source.includes("textureOffset(s5, vec2(r0.xy), ivec2(-2, 3))"));
});
test("zero offsets retain ordinary sampling", () =>
{
    const {source} = CjsWebglFormat.emitGlsl(shader(72, 0, 0));
    assert.ok(source.includes("textureLod(s5, vec2(r0.xy), 0.0)"));
    assert.ok(!source.includes("textureLodOffset"));
});
