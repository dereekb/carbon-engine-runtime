// Not Carbon: Tr2GpuParticleSystem's draw with no visible list. The shipped
// managed/space/specialfx/particles/gpu/quads effect reads a list that compute
// builds; here six vertices go to every slot, and a dead or culled slot collapses.
// The formulas are the shipped effect's, with three differences. The frustum test
// goes to the rasterizer, because the update's planes are not per-frame data. The
// size cull moves here from the update. The froxel fog the shipped pixel stage reads
// is left out, because WebGL2 has no compute to fill EveSceneFogVolumeMap.

#include "../../cbuffers/EveSpaceScenePerFrame.fxh"
#include "ParticleState.fxh"

float4 AtlasMapSize = float4( 1024.0, 8.0, 0.0, 0.0 );

cbuffer ParticleDraw : register( b3 )
{
    float4 ParticleTextureSize; // x: the state textures' width
};

// Tr2sRGB as the shipped effect declares it: the pixel stage encodes its result, so the atlas must decode.
Texture2D AtlasMap : register( t0 )
<
    bool Tr2sRGB = true;
>;
SamplerState AtlasMapSampler
{
    Filter = MIN_MAG_MIP_LINEAR;
    AddressU = WRAP;
    AddressV = WRAP;
};

struct QuadVSOutput
{
    float4 position : SV_POSITION;
    float2 texCoord : TEXCOORD0;
    float4 color : TEXCOORD1;
};

/** The six corners of a slot's two triangles. */
float2 Corner( uint index )
{
    if( index == 0 || index == 4 ) return float2( 1.0, -1.0 );
    if( index == 1 ) return float2( -1.0, -1.0 );
    if( index == 3 ) return float2( 1.0, 1.0 );
    return float2( -1.0, 1.0 );
}

QuadVSOutput QuadVS( uint vertexId : SV_VertexID )
{
    QuadVSOutput output;
    output.position = float4( 2.0, 2.0, 2.0, 1.0 );
    output.texCoord = float2( 0.0, 0.0 );
    output.color = float4( 0.0, 0.0, 0.0, 0.0 );

    uint slot = vertexId / 6;
    uint width = uint( ParticleTextureSize.x );
    int3 texel = int3( int( slot % width ), int( slot / width ), 0 );
    uint4 word0 = ParticleState0.Load( texel );
    uint4 word1 = ParticleState1.Load( texel );
    float age = WordToFloat( word0.w );
    if( age < 0.0 )
    {
        return output;
    }

    uint emitter = word1.w & 65535;
    float seedWhole = float( word1.w >> 16 );
    float seed = seedWhole * 1.52590219e-05;
    float3 world = float3( WordToFloat( word0.x ), WordToFloat( word0.y ), WordToFloat( word0.z ) );
    float3 velocity = float3( WordToFloat( word1.x ), WordToFloat( word1.y ), WordToFloat( word1.z ) );

    float4 sizes = EmitterWords( emitter, 19 ); // xyz: over life, w: variance
    float3 view = mul( float4( world, 1.0 ), PerFrameVS.ViewMat ).xyz;

    // The size cull, as the shipped update tests it.
    float radius = ( abs( sizes.w ) + 1.0 ) * max( sizes.z, max( sizes.y, sizes.x ) );
    float depth = view.z;
    float onScreen = PerFrameVS.ProjectionMat[0][0] * PerFrameVS.TargetResolution.x * radius / max( -depth, 1.0 );
    if( onScreen <= 2.0 )
    {
        return output;
    }

    float lifetimeMin = EmitterWord( emitter, 0 );
    float lifetimeMax = EmitterWord( emitter, 1 );
    float t = saturate( age / ( seed * ( lifetimeMax - lifetimeMin ) + lifetimeMin ) );
    float inverse = 1.0 - t;
    float size = inverse * inverse * sizes.x + 2.0 * t * inverse * sizes.y + t * t * sizes.z;
    size *= sizes.w * seed + 1.0;

    float2 corner = Corner( vertexId % 6 );
    float halfSize = size * 0.25;
    float2 extent = halfSize * corner.yx;
    float stretch = EmitterWord( emitter, 31 );
    float2 offset;
    float fade = 1.0;
    if( stretch < 0.0 )
    {
        // Velocity stretch: the quad spans the path over -stretch seconds.
        float2 back = mul( float4( world + velocity * stretch, 1.0 ), PerFrameVS.ViewMat ).xy;
        float2 along = view.xy - back;
        float lengthSquared = dot( along, along );
        float inverseLength = 1.0 / sqrt( lengthSquared );
        float2 unit = along * inverseLength;
        offset = float2( dot( extent.yx, float2( unit.x, -unit.y ) ), dot( extent, unit ) );
        if( corner.x < 0.0 )
        {
            offset -= along;
        }
        fade = ( size * 0.5 ) / ( size * 0.5 + sqrt( lengthSquared ) );
    }
    else
    {
        float2 phase = float2( seedWhole, seedWhole ) * float2( 9.58752644e-05, 1.52590219e-04 );
        float direction = frac( phase.y ) > 0.5 ? 1.0 : -1.0;
        float angle = stretch * age * direction + phase.x;
        float sine = sin( angle );
        float cosine = cos( angle );
        offset = float2( extent.y * cosine + extent.x * sine, extent.y * sine - extent.x * cosine );
    }

    float4 placed = mul( float4( view.xy + offset, view.z, 1.0 ), PerFrameVS.ProjectionMat );
    output.position = placed;

    float2 pixels = ( halfSize / placed.w ) * PerFrameVS.TargetResolution;
    float small = saturate( min( pixels.x, pixels.y ) * 0.5 );

    float textureWord = EmitterWord( emitter, 2 );
    float2 atlas = ( corner * 0.5 + 0.5 ) / float2( AtlasMapSize.y, 1.0 );
    output.texCoord = float2( floor( textureWord ) / AtlasMapSize.y, 0.0 ) + atlas;

    // Four colours over life, the midpoint bending time.
    float bent = pow( t, -log2( frac( textureWord ) ) );
    float4 color0 = EmitterWords( emitter, 3 );
    float4 color1 = EmitterWords( emitter, 7 );
    float4 color2 = EmitterWords( emitter, 11 );
    float4 color3 = EmitterWords( emitter, 15 );
    float4 color;
    if( bent <= 0.333 )
    {
        color = color0 + ( color1 - color0 ) * ( bent * 3.0030029 );
    }
    else if( bent <= 0.666 )
    {
        color = color1 + ( color2 - color1 ) * ( bent * 3.0030029 - 1.0 );
    }
    else
    {
        color = color2 + ( color3 - color2 ) * ( bent * 2.99401212 - 1.99401212 );
    }
    output.color = float4( color.rgb * color.a, color.a ) * ( small * fade );
    return output;
}

float4 QuadPS( QuadVSOutput input ) : SV_Target
{
    float4 color = AtlasMap.SampleBias( AtlasMapSampler, input.texCoord, PerFramePS.SceneMipLodBias ) * input.color;
    float3 gamma = exp2( log2( max( color.rgb, float3( 1e-35, 1e-35, 1e-35 ) ) ) * PerFramePS.GammaBrightness );
    float3 high = pow( gamma, float3( 0.416666657, 0.416666657, 0.416666657 ) ) * 1.05499995 - 0.0549999997;
    float3 low = gamma * 12.9200001;
    return float4( gamma.r < 0.00313080009 ? low.r : high.r, gamma.g < 0.00313080009 ? low.g : high.g, gamma.b < 0.00313080009 ? low.b : high.b, color.a );
}

technique Main
{
    pass P0
    {
        AlphaBlendEnable = true;
        SrcBlend = ONE;
        DestBlend = INVSRCALPHA;
        VertexShader = compile vs_5_0 QuadVS();
        PixelShader = compile ps_5_0 QuadPS();
    }
}
