import test from "node:test";
import assert from "node:assert/strict";
import { CjsWebglFormat } from "../../../../../src/resource/formats/webgl/index.js";
import { buildTwoSamplerPixelDxbc, buildComparisonSamplePixelDxbc } from "./synthetic.js";

test("implicit 2D samples retain native sampling behind a runtime raw-depth switch", () =>
{
    const { source } = CjsWebglFormat.emitGlsl(buildTwoSamplerPixelDxbc([0], [5]));
    assert.match(source, /uniform bool cjsRawDepthLinear_s5;/);
    assert.match(source, /cjsRawDepthLinear_s5 \? cjsRawDepthLinear\(s5, vec2\(r0.xy\)\) : texture\(s5, vec2\(r0.xy\)\)/);
    assert.match(source, /max\(dot\(dx, dx\), dot\(dy, dy\)\) <= 1.0/);
    assert.match(source, /mix\(mix\(a, b, f.x\), mix\(c, d, f.x\), f.y\)/);
});

test("comparison sampling is not routed through raw-depth filtering", () =>
{
    const { source } = CjsWebglFormat.emitGlsl(buildComparisonSamplePixelDxbc(3));
    assert.doesNotMatch(source, /cjsRawDepthLinear/);
});
