// A 2D image behind the interior scene, placed and scaled over the screen: an
// effect for Tr2InteriorScene.backgroundEffect (Tr2InteriorScene_Blue.cpp:346),
// which the scene draws with Tr2Renderer::DrawCameraSpaceScreenQuad before its
// geometry (Tr2InteriorScene.cpp:648-651). Not Carbon: no shipped interior
// scene authors a background effect. The same effect as backgroundimage.fx,
// with the same parameters, over the interior scene's per-frame buffers
// (Tr2PerFrame).
//
// BackgroundPlacement.xy moves the image's centre from the screen's, in screen
// widths and heights (+x right, +y down); .zw scales it. BackgroundSettings.x
// picks how the image fits the screen before placement: 0 stretches it over
// the screen, 1 covers the screen keeping its aspect, 2 fits inside it keeping
// its aspect. Outside the image the pass shows BackgroundColor.

#define BACKGROUND_INTERIOR
#include "../cbuffers/Tr2PerFrame.fxh"
#include "backgroundimage.fxh"
