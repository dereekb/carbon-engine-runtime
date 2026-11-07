// Not Carbon: one emit request of Tr2GpuParticleSystem as a draw over a run of state
// slots, where the shipped managed/space/specialfx/particles/gpu/emit effect is a
// compute shader popping a dead list. The formulas are the shipped effect's.
//
// A ring cursor on the CPU replaces the dead list, because WebGL2 has no atomics.
// So at saturation the oldest slots are overwritten, where Carbon drops new
// particles. The shipped effect chains its random state from one particle to the
// next on a thread; a fragment has no neighbour, so each slot seeds its own.

#include "ParticleState.fxh"

cbuffer ParticleEmit : register( b3 )
{
    float4 EmitRun;             // x: first slot, y: slots, z: state texture width, w: capacity
    float4 EmitSeed;            // x: the request's seed, y: its emitter params entry
    float4 EmitPosition;        // w: radius
    float4 EmitPositionPrevious;
    float4 EmitDirection;       // w: angle
    float4 EmitDirectionPrevious; // w: inner angle
    float4 EmitVelocity;        // w: minimum speed
    float4 EmitVelocityPrevious; // w: maximum speed
};

struct EmitVSOutput
{
    float4 position : SV_POSITION;
};

struct EmitPSOutput
{
    uint4 state0 : SV_Target0;
    uint4 state1 : SV_Target1;
};

/** A full-target triangle, from the vertex index. The scissor limits it to the run's rows. */
EmitVSOutput EmitVS( uint vertexId : SV_VertexID )
{
    EmitVSOutput output;
    float2 corner = float2( float( ( vertexId << 1 ) & 2 ), float( vertexId & 2 ) );
    output.position = float4( corner * 2.0 - 1.0, 0.0, 1.0 );
    return output;
}

/** The shipped hash that seeds a stream. */
uint HashSeed( uint value )
{
    uint hash = ( value ^ uint( 61 ) ) ^ ( value >> 16 );
    hash = hash * uint( 9 );
    hash = ( hash >> 4 ) ^ hash;
    hash = hash * uint( 668265261 );
    return ( hash >> 15 ) ^ hash;
}

/** The shipped xorshift step. */
uint NextRandom( uint state )
{
    uint next = state ^ ( state << 13 );
    next = ( next >> 17 ) ^ next;
    return ( next << 5 ) ^ next;
}

EmitPSOutput EmitPS( EmitVSOutput input )
{
    int width = int( EmitRun.z );
    int slot = int( input.position.y ) * width + int( input.position.x );
    int particle = slot - int( EmitRun.x );
    if( particle < 0 )
    {
        particle += int( EmitRun.w );
    }
    if( particle >= int( EmitRun.y ) )
    {
        discard;
    }

    uint state = HashSeed( uint( EmitSeed.x ) + uint( particle ) );

    state = NextRandom( state );
    float along = float( state ) * 2.32830644e-10;
    float3 direction = normalize( EmitDirectionPrevious.xyz + along * ( EmitDirection.xyz - EmitDirectionPrevious.xyz ) );

    state = NextRandom( state );
    float angle = EmitDirection.w >= 1.57079637 ? 3.14159274 : EmitDirection.w;
    float halfAngle = ( ( angle - EmitDirectionPrevious.w ) * float( state ) * 2.32830644e-10 + EmitDirectionPrevious.w ) * 0.5;
    float sinHalf = sin( halfAngle );
    float cosHalf = cos( halfAngle );

    state = NextRandom( state );
    float around = float( state ) * 1.46291807e-09;
    float sinAround = sin( around );
    float cosAround = cos( around );
    state = NextRandom( state );

    // The rotation of the cone, from the shipped effect's quaternion terms.
    float a = sinHalf * cosAround;
    float b = sinHalf * sinAround;
    float c = cosHalf * sinAround;
    float d = cosHalf * cosAround;
    float forward = d * d + c * c - a * a - b * b;
    float side = 2.0 * a * d - 2.0 * b * c;
    float up = 2.0 * a * c + 2.0 * b * d;

    float3 axis = abs( direction.y ) < abs( direction.x ) ? float3( 1.0, 0.0, 0.0 ) : float3( 0.0, 0.0, 1.0 );
    float3 first = normalize( direction.yzx * axis.yzx - direction.zxy * axis );
    float3 second = direction.yzx * first.zxy - direction.zxy * first.yzx;
    float3 spread = direction * forward + second * up + first * side;

    float3 position = spread * EmitPosition.w + EmitPositionPrevious.xyz + along * ( EmitPosition.xyz - EmitPositionPrevious.xyz );

    state = NextRandom( state );
    float speed = ( EmitVelocityPrevious.w - EmitVelocity.w ) * float( state ) * 2.32830644e-10 + EmitVelocity.w;
    float3 velocity = spread * speed + EmitVelocityPrevious.xyz + along * ( EmitVelocity.xyz - EmitVelocityPrevious.xyz );

    state = NextRandom( state );

    EmitPSOutput output;
    output.state0 = uint4( asuint( position.x ), asuint( position.y ), asuint( position.z ), uint( 0 ) );
    output.state1 = uint4( asuint( velocity.x ), asuint( velocity.y ), asuint( velocity.z ), uint( EmitSeed.y ) | ( state << 16 ) );
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
        VertexShader = compile vs_5_0 EmitVS();
        PixelShader = compile ps_5_0 EmitPS();
    }
}
