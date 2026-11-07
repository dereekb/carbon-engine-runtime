#ifndef PARTICLESTATE_FXH
#define PARTICLESTATE_FXH

// Tr2GpuParticleSystem's state on a backend with no compute (WebGL2). Carbon's
// 32-byte ParticleData (Tr2GpuParticleSystem.h:137-143) in two RGBA32UI textures,
// one record to a texel: position and age, then velocity and the packed
// emitter index and seed. RGBA32UI renders in core WebGL2 and keeps the seed exact.
Texture2D<uint4> ParticleState0 : register( t1 );
Texture2D<uint4> ParticleState1 : register( t2 );

// EmitterParamsGpu (128 bytes): 32 words, four texels to an entry, in the
// layout Tr2GpuParticleSystem packs for the `Emitters` structured buffer.
Texture2D<uint4> EmitterParams : register( t3 );

/** A word as a float. A plain asfloat is a float2 to this compiler, as Carbon's table has it (ParserState.cpp:50). */
float WordToFloat( uint word )
{
    return asfloat( word ).x;
}

/** One word of an emitter's params. */
float EmitterWord( uint emitter, uint word )
{
    uint texel = emitter * 8 + word / 4;
    uint4 words = EmitterParams.Load( int3( int( texel & 2047 ), int( texel >> 11 ), 0 ) );
    uint value = words[word & 3];
    return WordToFloat( value );
}

/** Four consecutive words of an emitter's params. */
float4 EmitterWords( uint emitter, uint word )
{
    return float4( EmitterWord( emitter, word ), EmitterWord( emitter, word + 1 ), EmitterWord( emitter, word + 2 ), EmitterWord( emitter, word + 3 ) );
}

#endif // PARTICLESTATE_FXH
