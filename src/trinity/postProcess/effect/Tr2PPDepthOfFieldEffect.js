// Source: trinity/trinity/PostProcess/Effects/Tr2PPDepthOfFieldEffect.h
// Source: trinity/trinity/PostProcess/Effects/Tr2PPDepthOfFieldEffect.cpp
import { exposure as be } from "#be";
import { meta, type } from "#schema";
import { Tr2PPEffect } from "./Tr2PPEffect.js";
import { blue, EnumRegistrationType } from "#blue";


/**
 * Depth-of-field parameters - focal distance and length, circle-of-confusion and
 * blur scale, bokeh shape - plus the process-wide switch that enables the effect
 * at all.
 */
@be.define({
  name: "Tr2PPDepthOfFieldEffect",
  // Tr2PPDepthOfFieldEffect_Blue.cpp:23-34, in Carbon's order.
  interfaces: [ Tr2PPEffect ],
  members: [
    [ be.ATTR, "focalDistance", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "focalLength", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "scale", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "cocScale", be.READWRITE ],
    [ be.ATTR, "foregroundBlurNeeded", be.READWRITE | be.PERSIST ],
    [ be.ATTR_CHOOSER, "bokehShape", be.READWRITE | be.PERSIST | be.ENUM, "trinity.Tr2Bokeh.Shape" ],
    [ be.ATTR, "useTAAFriendlyBokeh", be.READWRITE ]
  ],
  chainTo: Tr2PPEffect
})
export class Tr2PPDepthOfFieldEffect extends Tr2PPEffect
{

  /** Carbon: MAP_ATTRIBUTE_WITH_CHOOSER (trinity/trinity/PostProcess/Effects/Tr2PPDepthOfFieldEffect_Blue.cpp:31); chooser BokehShapeChooser (trinity/trinity/PostProcess/Effects/Tr2PPDepthOfFieldEffect_Blue.cpp:10). */
  @type.int32
  @type.enum("trinity.Tr2Bokeh.Shape")
  bokehShape = Tr2PPDepthOfFieldEffect.Disk;

  @type.float32
  scale = 0;

  @type.float32
  cocScale = 1;

  @type.boolean
  useTAAFriendlyBokeh = true;

  @type.float32
  focalLength = 0;

  @type.boolean
  foregroundBlurNeeded = true;

  @type.float32
  focalDistance = 0;

  /**
   * Returns the shader define name for the selected bokeh shape, falling back to
   * the disk shape for an unknown value.
   */

  GetBokehShapeString()
  {
    return Tr2PPDepthOfFieldEffect.BokehShapeStrings[this.bokehShape]
      ?? Tr2PPDepthOfFieldEffect.BokehShapeStrings[Tr2PPDepthOfFieldEffect.Disk];
  }

  /**
   * Carbon IsActive (Tr2PPDepthOfFieldEffect.cpp:25-28): the
   * `postprocessDofEnabled` setting, the base activity gate, and a positive
   * blur scale.
   */

  IsActive()
  {
    return Tr2PPDepthOfFieldEffect.postprocessDofEnabled && super.IsActive() && this.scale > 0;
  }

  /**
   * Ours (named after ccpwgl's `depthOfFieldTransparentDepth`): draws the
   * transparent and additive batches as their own depth-of-field layers, each
   * blurred by the depth of its nearest visible surface rather than the
   * opaque depth behind it, then composited over the opaque result. Off is
   * exactly Carbon's depth of field. Not persisted, so Carbon's .black and
   * .red are untouched.
   *
   * @cjs
   */
  @meta.mapAttribute(meta.READWRITE)
  @type.boolean
  transparentDepth = false;

  /**
   * `g_postprocessDofEnabled` (Tr2PPDepthOfFieldEffect.cpp:7-8), registered as
   * the `postprocessDofEnabled` setting: depth of field for every post process.
   * Off, as in Carbon; the client turns it on.
   */
  @meta.setting("postprocessDofEnabled")
  static postprocessDofEnabled = false;

  /**
   * Ours: carries a post process's authored `foregroundBlurNeeded` through
   * the scene's attribute merge. Carbon's Tr2PostProcessAttributes::Set never
   * copies it and the attribute is not exposed, so Carbon's merged depth of
   * field never blurs the foreground (CE-230;
   * Tr2PostProcessAttributes.cpp:438-444). Off keeps Carbon's behaviour.
   * ccpwgl reads the flag straight off the effect.
   *
   * @cjs
   */
  @meta.setting("postprocessDofCarryForegroundBlur")
  static postprocessDofCarryForegroundBlur = false;

  static Shape = { Disk: 0, Triangle: 1, Rectangle: 2, Pentagon: 3, Hexagon: 4, Heart: 5 };

  static Disk = 0;

  static Triangle = 1;

  static Rectangle = 2;

  static Pentagon = 3;

  static Hexagon = 4;

  static Heart = 5;

  static BokehShapeStrings = Object.freeze([
    "BOKEH_SHAPE_DISK",
    "BOKEH_SHAPE_TRIANGLE",
    "BOKEH_SHAPE_RECTANGLE",
    "BOKEH_SHAPE_PENTAGON",
    "BOKEH_SHAPE_HEXAGON",
    "BOKEH_SHAPE_HEART"
  ]);

}

blue.enums.Create("trinity.Tr2Bokeh.Shape", Tr2PPDepthOfFieldEffect.Shape, {
  exposedName: "BokehShapeType", exposure: EnumRegistrationType.ENUM_REG_ENUM_OBJECT_ON_MODULE,
  chooser: [
    { name: "Disk", value: Tr2PPDepthOfFieldEffect.Shape.Disk, description: "A perfectly circular aperture" },
    { name: "Triangle", value: Tr2PPDepthOfFieldEffect.Shape.Triangle, description: "An aperture with 3 sides" },
    { name: "Rectangle", value: Tr2PPDepthOfFieldEffect.Shape.Rectangle, description: "An aperture with 4 sides" },
    { name: "Pentagon", value: Tr2PPDepthOfFieldEffect.Shape.Pentagon, description: "An aperture with 5 sides" },
    { name: "Hexagon", value: Tr2PPDepthOfFieldEffect.Shape.Hexagon, description: "An aperture with 6 sides" },
    { name: "Heart", value: Tr2PPDepthOfFieldEffect.Shape.Heart, description: "A heart-shaped aperture <3" }
  ]
});
