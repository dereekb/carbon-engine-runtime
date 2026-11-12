import assert from "node:assert/strict";
import test from "node:test";
import {
    NormalizeResourcePath,
    ResolveEffectPath,
    ShaderModelSuffix,
    Tr2PlatformInfo
} from "../../../npm/dist/core/index.js";

test("ResolveEffectPath substitutes the platform name Carbon substitutes", () =>
{
    assert.equal(
        ResolveEffectPath("res:/graphics/effect/space/quadv5.fx", { platformName: "webgpu" }),
        "res:/graphics/effect/space/quadv5.fx".replace("/effect/", "/effect.webgpu/").replace(".fx", ".sm_depth")
    );

    assert.equal(
        ResolveEffectPath("RES:\\Graphics\\Effect\\Space\\QuadV5.fx", { platformName: "webgl", shaderModel: "medium" }),
        "res:/graphics/effect.webgl/space/quadv5.sm_hi"
    );
});

test("ResolveEffectPath leaves an already-qualified tree alone", () =>
{
    // Substitution touches `/effect/` only, which is what lets a qualified path
    // override the configured default with no second mechanism - and it is how
    // CCP's own trees are reachable while testing.
    assert.equal(
        ResolveEffectPath("res:/graphics/effect.gles2/space/quadv5.fx", { platformName: "webgl" }),
        "res:/graphics/effect.gles2/space/quadv5.sm_depth"
    );

    // A compiled path is already the answer.
    assert.equal(
        ResolveEffectPath("res:/graphics/effect.webgpu/space/quadv5.sm_hi", { platformName: "webgpu" }),
        "res:/graphics/effect.webgpu/space/quadv5.sm_hi"
    );

    assert.equal(ResolveEffectPath("", { platformName: "webgpu" }), "");
});

test("ResolveEffectPath always resolves: with no platform name it uses Carbon's stub build's", () =>
{
    // Carbon's platform name is a compile-time constant in every build, "dx11" in the headless stub one
    // (trinityal/include/TrinityALForward.h:64-68), so an authored path never lacks a tree to resolve into.
    assert.equal(
        ResolveEffectPath("res:/graphics/effect/space/quadv5.fx", {}),
        "res:/graphics/effect.dx11/space/quadv5.sm_depth"
    );

    assert.throws(() => ShaderModelSuffix("ultra"), RangeError);
});

test("ShaderModelSuffix follows the tier policy, not the suffix spelling", () =>
{
    // .sm_depth is the HIGH tier and is not a depth-only shader; .sm_hi is
    // MEDIUM. Reading the names literally is what makes a texture-budget
    // measurement describe the wrong variant.
    assert.equal(ShaderModelSuffix("high"), "sm_depth");
    assert.equal(ShaderModelSuffix("medium"), "sm_hi");
    assert.equal(ShaderModelSuffix("low"), "sm_lo");
    assert.equal(ShaderModelSuffix("sm_depth"), "sm_depth");
});

test("NormalizeResourcePath routes on one spelling", () =>
{
    assert.equal(
        NormalizeResourcePath("RES:\\Graphics\\Effect\\Space\\QuadV5.fx"),
        "res:/graphics/effect/space/quadv5.fx"
    );
    assert.equal(NormalizeResourcePath(null), "");
});

test("Tr2PlatformInfo resolves against its own platform name", async () =>
{
    const platform = await Tr2PlatformInfo.Detect({
        webgl: false,
        adapter: { info: {}, features: new Set(), limits: {} }
    });

    assert.equal(
        platform.ResolveEffectPath("res:/graphics/effect/space/quadv5.fx"),
        "res:/graphics/effect.webgpu/space/quadv5.sm_depth"
    );

    // No backend detected: the path still resolves, into Carbon's stub build's tree.
    const none = await Tr2PlatformInfo.Detect({ gpu: null, webgl: false });
    assert.equal(none.ResolveEffectPath("res:/graphics/effect/space/quadv5.fx"), "res:/graphics/effect.dx11/space/quadv5.sm_depth");
});
