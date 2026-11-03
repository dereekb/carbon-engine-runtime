// A 2D image behind the space scene, placed and scaled over the screen: an
// effect for EveSpaceScene.backgroundEffect (EveSpaceScene_Blue.cpp:77-78), the
// hook Carbon's nebula (res:/graphics/effect/managed/space/specialfx/background.fx)
// uses. Not Carbon: CCP ships no 2D background effect for that pass.
//
// The background pass draws it with Tr2Renderer::DrawCameraSpaceScreenQuad
// (EveSpaceScene.cpp:2104-2114), whose four vertices are the screen's corners
// in view space with texture coordinates 0..1 from the top left
// (Tr2RenderUtils.cpp:53-90). Like the nebula, it disables depth and writes
// none, so depth of field and fog see the far plane behind it.
//
// BackgroundPlacement.xy moves the image's centre from the screen's, in screen
// widths and heights (+x right, +y down); .zw scales it. BackgroundSettings.x
// picks how the image fits the screen before placement: 0 stretches it over
// the screen, 1 covers the screen keeping its aspect, 2 fits inside it keeping
// its aspect. Outside the image the pass shows BackgroundColor.

#include "../cbuffers/EveSpaceScenePerFrame.fxh"
#include "backgroundimage.fxh"
