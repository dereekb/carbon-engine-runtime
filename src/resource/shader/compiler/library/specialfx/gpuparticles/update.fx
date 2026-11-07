// Not Carbon: the update of Tr2GpuParticleSystem as a full-target draw, where the
// shipped managed/space/specialfx/particles/gpu/update effect is a compute shader.
// The formulas are the shipped effect's. WebGL2 has no compute, storage buffers
// or atomics, so the dead and visible lists it rebuilds do not exist here: a dead
// slot keeps a negative age, and the frustum and size tests move to the draw.

#include "ParticleState.fxh"

cbuffer ParticleUpdate : register( b3 )
{
    float4 UpdateTime;          // w: dt
    float4 UpdateOriginShift;   // xyz: the origin shift
    float4 UpdateTurbulenceOffset;
    float4 UpdateTurbulenceAnimation;
};

Texture3D ParticleNoise : register( t0 );
SamplerState ParticleNoiseSampler : register( s0 );

struct UpdateVSOutput
{
    float4 position : SV_POSITION;
};

struct UpdatePSOutput
{
    uint4 state0 : SV_Target0;
    uint4 state1 : SV_Target1;
};

/** A full-target triangle, from the vertex index. */
UpdateVSOutput UpdateVS( uint vertexId : SV_VertexID )
{
    UpdateVSOutput output;
    float2 corner = float2( float( ( vertexId << 1 ) & 2 ), float( vertexId & 2 ) );
    output.position = float4( corner * 2.0 - 1.0, 0.0, 1.0 );
    return output;
}

float3 Noise( float3 uvw )
{
    return ParticleNoise.SampleLevel( ParticleNoiseSampler, uvw, 0.0 ).xyz;
}

UpdatePSOutput UpdatePS( UpdateVSOutput input )
{
    UpdatePSOutput output;
    int3 texel = int3( int( input.position.x ), int( input.position.y ), 0 );
    uint4 word0 = ParticleState0.Load( texel );
    uint4 word1 = ParticleState1.Load( texel );
    output.state0 = word0;
    output.state1 = word1;

    float age = WordToFloat( word0.w );
    if( age < 0.0 )
    {
        return output;
    }

    float dt = UpdateTime.w;
    float3 position = float3( WordToFloat( word0.x ), WordToFloat( word0.y ), WordToFloat( word0.z ) );
    float3 velocity = float3( WordToFloat( word1.x ), WordToFloat( word1.y ), WordToFloat( word1.z ) );
    uint emitter = word1.w & 65535;
    float seed = float( word1.w >> 16 ) * 1.52590219e-05;

    float lifetimeMin = EmitterWord( emitter, 0 );
    float lifetimeMax = EmitterWord( emitter, 1 );
    age += dt;
    if( age >= seed * ( lifetimeMax - lifetimeMin ) + lifetimeMin )
    {
        output.state0.w = asuint( -1.0 );
        return output;
    }

    float4 forces = EmitterWords( emitter, 23 );    // x: drag, y: turbulence, z: turbulence frequency, w: gravity
    float4 attractor = EmitterWords( emitter, 27 ); // xyz: position, w: strength

    float3 next = float3( velocity.x, velocity.y + forces.w * dt, velocity.z );

    // Turbulence: three octaves of the noise volume, offset by its own animation.
    float3 uvw = ( position + UpdateTurbulenceOffset.xyz ) * forces.z + Noise( UpdateTurbulenceAnimation.xyz * 0.03125 );
    float3 turbulence = Noise( uvw ) - 0.5;
    turbulence = ( Noise( uvw.zyx + uvw.zyx ) - 0.5 ) * 0.5 + turbulence;
    turbulence = ( Noise( uvw * 4.0 ) - 0.5 ) * 0.25 + turbulence;
    next += forces.y * turbulence * dt;

    if( attractor.w != 0.0 )
    {
        next += attractor.w * normalize( attractor.xyz - position ) * dt;
    }

    // Drag: negative drag scales with speed, positive with velocity.
    if( forces.x < 0.0 )
    {
        float speed = length( next );
        if( speed > 0.0 )
        {
            next += forces.x * ( speed * next ) * dt;
        }
    }
    else
    {
        next -= forces.x * next * dt;
    }

    float3 moved = next * dt + UpdateOriginShift.xyz + position;
    if( any( moved != moved ) )
    {
        output.state0.w = asuint( -1.0 );
        return output;
    }

    output.state0 = uint4( asuint( moved.x ), asuint( moved.y ), asuint( moved.z ), asuint( age ) );
    output.state1 = uint4( asuint( next.x ), asuint( next.y ), asuint( next.z ), word1.w );
    return output;
}

technique Main
{
    pass P0
    {
        ZEnable = false;
        ZWriteEnable = false;
        ZFunc = ALWAYS;
        CullMode = NONE;
        AlphaBlendEnable = false;
        VertexShader = compile vs_5_0 UpdateVS();
        PixelShader = compile ps_5_0 UpdatePS();
    }
}
