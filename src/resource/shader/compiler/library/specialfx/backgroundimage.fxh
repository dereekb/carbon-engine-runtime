// The 2D background image's parameters and passes, shared by its scene entry
// files: backgroundimage.fx (EveSpaceScene) and backgroundimageinterior.fx
// (Tr2InteriorScene). Each includes its scene's per-frame constant buffers
// first; both scenes bind PerFrameVS.ProjectionMat, at different registers.
// The space scene's pixel shader reads PerFramePS.ViewportSize; the interior
// scene's has no viewport size, so with BACKGROUND_INTERIOR defined the vertex
// shader passes the screen's aspect from the projection, which is all the fit
// uses.

#ifndef BACKGROUNDIMAGE_FXH
#define BACKGROUNDIMAGE_FXH

float4 BackgroundPlacement = float4( 0.0, 0.0, 1.0, 1.0 );
float4 BackgroundSettings = float4( 1.0, 0.0, 0.0, 0.0 );
float4 BackgroundColor = float4( 0.0, 0.0, 0.0, 1.0 );
float4 BackgroundTint = float4( 1.0, 1.0, 1.0, 1.0 );

Texture2D BackgroundMap;
SamplerState BackgroundMapSampler
{
    Filter = MIN_MAG_MIP_LINEAR;
    AddressU = CLAMP;
    AddressV = CLAMP;
};

#define FIT_STRETCH 0
#define FIT_COVER 1
#define FIT_CONTAIN 2

struct BackgroundImageVSInput
{
    float4 position : POSITION;
    float2 texCoord : TEXCOORD0;
};

struct BackgroundImageVSOutput
{
    float4 position : SV_Position;
    float2 texCoord : TEXCOORD0;
#ifdef BACKGROUND_INTERIOR
    // The screen's aspect, width over height, from the projection's scales.
    float screenAspect : TEXCOORD1;
#endif
};

BackgroundImageVSOutput BackgroundImageVS( BackgroundImageVSInput input )
{
    BackgroundImageVSOutput output;
    output.position = mul( input.position, PerFrameVS.ProjectionMat );
    // The camera-space quad expects the shader to push z to w
    // (Tr2RenderUtils.cpp:80), as the nebula's vertex shader does.
    output.position.z = output.position.w;
    output.texCoord = input.texCoord;
#ifdef BACKGROUND_INTERIOR
    output.screenAspect = PerFrameVS.ProjectionMat[1][1] / PerFrameVS.ProjectionMat[0][0];
#endif
    return output;
}

// The image's size on the screen, in screen widths and heights, before
// placement scales it.
float2 FitSize( float2 imageSize, float2 screenSize, int fit )
{
    float imageAspect = imageSize.x / max( imageSize.y, 1.0 );
    float screenAspect = screenSize.x / max( screenSize.y, 1.0 );
    float ratio = imageAspect / screenAspect;
    if( fit == FIT_COVER )
    {
        return ratio > 1.0 ? float2( ratio, 1.0 ) : float2( 1.0, 1.0 / ratio );
    }
    if( fit == FIT_CONTAIN )
    {
        return ratio > 1.0 ? float2( 1.0, 1.0 / ratio ) : float2( ratio, 1.0 );
    }
    return float2( 1.0, 1.0 );
}

float4 BackgroundImagePS( BackgroundImageVSOutput input ) : SV_Target
{
    uint width;
    uint height;
    BackgroundMap.GetDimensions( width, height );

#ifdef BACKGROUND_INTERIOR
    float2 screenSize = float2( input.screenAspect, 1.0 );
#else
    float2 screenSize = PerFramePS.ViewportSize;
#endif
    float2 size = FitSize( float2( width, height ), screenSize, (int)BackgroundSettings.x )
        * BackgroundPlacement.zw;
    float2 uv = (input.texCoord - 0.5 - BackgroundPlacement.xy) / size + 0.5;

    // Sampled before the outside test, never under it: WebGPU allows an
    // implicit-derivative sample only in uniform control flow, and the test
    // varies per pixel. The clamped sampler makes the outside sample harmless.
    float4 image = BackgroundMap.Sample( BackgroundMapSampler, uv ) * BackgroundTint;
    float outside = any( uv < 0.0 ) || any( uv > 1.0 ) ? 1.0 : 0.0;
    return lerp( image, BackgroundColor, outside );
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
        VertexShader = compile vs_5_0 BackgroundImageVS();
        PixelShader = compile ps_5_0 BackgroundImagePS();
    }
}

#endif // BACKGROUNDIMAGE_FXH
