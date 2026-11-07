import { test } from "node:test";
import assert from "node:assert/strict";
import { CompileEffectFile } from "../../src/resource/shader/compiler/ShaderCompiler/shaderCompiler.js";
import { Platform } from "../../src/resource/shader/compiler/platforms.js";
import { Macro } from "../../src/resource/shader/compiler/Macro.js";
import { CjsFxEffectCompilerWebGL2 } from "../../src/resource/shader/compiler/EffectCompilerWebGL2/index.js";
import { CjsCarbonEffectReader } from "../../src/resource/format/carbonEffect/CjsCarbonEffectReader.js";
import { readGlslBackendBlock } from "../../src/resource/formats/webgl/core/glslBackendBlock.js";

const SOURCE = `
struct Emitter
{
    float4 colour;
    float4 size;
};

StructuredBuffer<Emitter> Emitters : register( t3 );

struct VSOutput
{
    float4 position : SV_POSITION;
    float2 texCoord : TEXCOORD0;
};

VSOutput MainVS( float4 position : POSITION, float2 texCoord : TEXCOORD0 )
{
    VSOutput output;
    output.position = position;
    output.texCoord = texCoord;
    return output;
}

float4 MainPS( VSOutput input ) : SV_Target
{
    Emitter emitter = Emitters[(int)input.texCoord.x];
    return emitter.colour * emitter.size.x;
}

technique Main
{
    pass P0
    {
        VertexShader = compile vs_5_0 MainVS();
        PixelShader = compile ps_5_0 MainPS();
    }
}
`;

/** Compiles the fixture for WebGL2 and reads its pixel stage back. */
function compile()
{
    const compiled = CompileEffectFile("/fixture.fx", {
        read: path => path === "/fixture.fx" ? SOURCE : null,
        compilers: new Map([ [ Platform.PLATFORM_WEBGL2, session => new CjsFxEffectCompilerWebGL2(session) ] ]),
        defines: [ new Macro("PLATFORM", "webgl2") ]
    });
    assert.ok(compiled.bytes, compiled.messages.join("\n"));
    const pass = new CjsCarbonEffectReader(new Uint8Array(compiled.bytes), { source: "/fixture.fx" }).readDescription(0).techniques[0].passes[0];
    return {
        pixel: new TextDecoder().decode(pass.stages.find(stage => stage.type === 1).shaderData.bytes),
        block: readGlslBackendBlock(pass.backendBlock.bytes)
    };
}

test("a pixel-stage structured buffer is the data texture the AL fills", () =>
{
    const { pixel, block } = compile();
    const binding = block.stages.pixel.bindings.find(item => item.kind === "structuredTexture");
    assert.deepEqual([ binding.registerIndex, binding.name, binding.strideBytes, binding.width ], [ 3, "sb3", 32, 2048 ]);
    assert.ok(pixel.includes("uniform highp usampler2D sb3;"));
});

test("each element row is one texel, addressed as the emitter and the AL address it", () =>
{
    const { pixel } = compile();
    assert.ok(pixel.includes("uintBitsToFloat(texelFetch(sb3, ivec2((index * 2 + 0) & 2047, (index * 2 + 0) >> 11), 0))"));
    assert.ok(pixel.includes("uintBitsToFloat(texelFetch(sb3, ivec2((index * 2 + 1) & 2047, (index * 2 + 1) >> 11), 0))"));
});
