import { exposure as be } from "#be";
import { IRoot } from "../../blue/blueexposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type } from "#schema";
import { blue, EnumRegistrationType } from "#blue";
import { vec3 } from "#math/vec3";
import { vec4 } from "#math/vec4";
import { EveSOFDataHullBuildFilter } from "./enums.js";

/** Carbon-authored hull record. */
@be.define({
  name: "EveSOFDataHull",
  inherit: [ IRoot ],
  // EveSOFData_Blue.cpp:956-1010, in Carbon's order.
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "sof6", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "description", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "category", be.READWRITE | be.PERSIST ],
    [ be.ATTR_CHOOSER, "buildClass", be.READWRITE | be.PERSIST | be.ENUM, "trinity.EveSOFDataHull.BuildClass" ],
    [ be.ATTR, "geometryResFilePath", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "boundingSphere", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "shapeEllipsoidCenter", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "shapeEllipsoidRadius", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "isSkinned", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "enableDynamicBoundingSphere", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "castShadow", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "opaqueAreas", be.READ | be.PERSIST ],
    [ be.ATTR, "decalAreas", be.READ | be.PERSIST ],
    [ be.ATTR, "transparentAreas", be.READ | be.PERSIST ],
    [ be.ATTR, "additiveAreas", be.READ | be.PERSIST ],
    [ be.ATTR, "distortionAreas", be.READ | be.PERSIST ],
    [ be.ATTR, "defaultPattern", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "spriteSets", be.READ | be.PERSIST ],
    [ be.ATTR, "spotlightSets", be.READ | be.PERSIST ],
    [ be.ATTR, "planeSets", be.READ | be.PERSIST ],
    [ be.ATTR, "spriteLineSets", be.READ | be.PERSIST ],
    [ be.ATTR, "hazeSets", be.READ | be.PERSIST ],
    [ be.ATTR, "banners", be.READ | be.PERSIST ],
    [ be.ATTR, "bannerSets", be.READ | be.PERSIST ],
    [ be.ATTR, "decalSets", be.READ | be.PERSIST ],
    [ be.ATTR, "lightSets", be.READ | be.PERSIST ],
    [ be.ATTR_CHOOSER, "impactEffectType", be.READWRITE | be.PERSIST | be.ENUM, "trinity.EveSOFDataHull.ImpactEffectType" ],
    [ be.ATTR, "booster", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "audioPosition", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "children", be.READ | be.PERSIST ],
    [ be.ATTR, "childSets", be.READ | be.PERSIST ],
    [ be.ATTR, "soundEmitters", be.READ | be.PERSIST ],
    [ be.ATTR, "controllers", be.READ | be.PERSIST ],
    [ be.ATTR, "animations", be.READ | be.PERSIST ],
    [ be.ATTR, "instancedMeshes", be.READ | be.PERSIST ],
    [ be.ATTR, "locatorTurrets", be.READ | be.PERSIST ],
    [ be.ATTR, "locatorSets", be.READ | be.PERSIST ],
    [ be.ATTR, "modelRotationCurvePath", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "modelTranslationCurvePath", be.READWRITE | be.PERSIST ]
  ]
})
export class EveSOFDataHull extends IRoot
{

  static BuildClass = {
    BUILDCLASS_SHIP: 0,
    BUILDCLASS_MOBILE: 1,
    BUILDCLASS_STATIONARY: 2,
    BUILDCLASS_SWARM: 3,
    BUILDCLASS_EXTENSION: 4,
    BUILDCLASS_COUNT: 5
  };

  static ImpactEffectType = {
    IMPACTEFFECT_NONE: 0,
    IMPACTEFFECT_ELLIPSOID: 1,
    IMPACTEFFECT_HULL: 2
  };

  static BuildFilter = EveSOFDataHullBuildFilter;

  /**
   * m_buildClass (BuildClass - enum BuildClass) [READWRITE, PERSIST, ENUM]
   * Carbon: MAP_ATTRIBUTE_WITH_CHOOSER (trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue.cpp:966); chooser EveSOFBuildClassChooser (trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue.cpp:937).
   */
  @type.int32
  @type.enum("trinity.EveSOFDataHull.BuildClass")
  buildClass = 0;

  /**
   * m_impactEffectType (ImpactEffectType - enum ImpactEffectType) [READWRITE, PERSIST, ENUM]
   * Carbon: MAP_ATTRIBUTE_WITH_CHOOSER (trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue.cpp:992); chooser EveSOFImpactEffectTypeChooser (trinity/trinity/Eve/SpaceObjectFactory/EveSOFData_Blue.cpp:947).
   */
  @type.int32
  @type.enum("trinity.EveSOFDataHull.ImpactEffectType")
  impactEffectType = 0;

  /** m_banners (PEveSOFDataHullBannerVector) [READ, PERSIST] */

  @type.list("EveSOFDataHullBanner")
  banners = [];

  /** m_soundEmitters (PEveSOFDataHullSoundEmitterVector) [READ, PERSIST] */

  @type.list("EveSOFDataHullSoundEmitter")
  soundEmitters = [];

  /** m_category (BlueSharedString) [READWRITE, PERSIST] */

  @type.string
  category = "";

  /** m_description (std::string) [READWRITE, PERSIST] */

  @type.string
  description = "";

  /** m_locatorSets (PIEveSOFDataHullLocatorSetVector) [READ, PERSIST] */

  @type.list("IEveSOFDataHullLocatorSet")
  locatorSets = [];

  /** m_isSkinned (bool) [READWRITE, PERSIST] */

  @type.boolean
  isSkinned = false;

  /** m_animations (PEveSOFDataHullAnimationVector) [READ, PERSIST] */

  @type.list("EveSOFDataHullAnimation")
  animations = [];

  /** m_children (PEveSOFDataHullChildVector) [READ, PERSIST] */

  @type.list("EveSOFDataHullChild")
  children = [];

  /** m_controllers (PEveSOFDataHullControllerVector) [READ, PERSIST] */

  @type.list("EveSOFDataHullController")
  controllers = [];

  /** m_instancedMeshes (PEveSOFDataInstancedMeshVector) [READ, PERSIST] */

  @type.list("EveSOFDataInstancedMesh")
  instancedMeshes = [];

  /** m_modelRotationCurvePath (std::string) [READWRITE, PERSIST] */

  @type.path
  modelRotationCurvePath = "";

  /** m_modelTranslationCurvePath (std::string) [READWRITE, PERSIST] */

  @type.path
  modelTranslationCurvePath = "";

  /** m_childSets (PEveSOFDataHullChildSetVector) [READ, PERSIST] */

  @type.list("EveSOFDataHullChildSet")
  childSets = [];

  /** m_boundingSphere (Vector4) [READWRITE, PERSIST] */

  @type.vec4
  boundingSphere = vec4.create();

  /** m_additiveAreas (PEveSOFDataHullAreaVector) [READ, PERSIST] */

  @type.list("EveSOFDataHullArea")
  additiveAreas = [];

  /** m_audioPosition (Vector3) [READWRITE, PERSIST] */

  @type.vec3
  audioPosition = vec3.create();

  /** m_bannerSets (PEveSOFDataHullBannerSetVector) [READ, PERSIST] */

  @type.list("EveSOFDataHullBannerSet")
  bannerSets = [];

  /** m_booster (EveSOFDataHullBoosterPtr) [READWRITE, PERSIST] */

  @type.object.ref("EveSOFDataHullBooster")
  booster = null;

  /** m_decalAreas (PEveSOFDataHullAreaVector) [READ, PERSIST] */

  @type.list("EveSOFDataHullArea")
  decalAreas = [];

  /** m_decalSets (PEveSOFDataHullDecalSetVector) [READ, PERSIST] */

  @type.list("EveSOFDataHullDecalSet")
  decalSets = [];

  /** m_defaultPattern (EveSOFDataPatternPerHullPtr) [READWRITE, PERSIST] */

  @type.object.ref("EveSOFDataPatternPerHull")
  defaultPattern = null;

  /** m_distortionAreas (PEveSOFDataHullAreaVector) [READ, PERSIST] */

  @type.list("EveSOFDataHullArea")
  distortionAreas = [];

  /** m_shapeEllipsoidCenter (Vector3) [READWRITE, PERSIST] */

  @type.vec3
  shapeEllipsoidCenter = vec3.create();

  /** m_shapeEllipsoidRadius (Vector3) [READWRITE, PERSIST] */

  @type.vec3
  shapeEllipsoidRadius = vec3.fromValues(-1, -1, -1);

  /** m_hazeSets (PEveSOFDataHullHazeSetVector) [READ, PERSIST] */

  @type.list("EveSOFDataHullHazeSet")
  hazeSets = [];

  /** m_name (std::string) [READWRITE, PERSIST] */

  @type.string
  name = "";

  /** m_lightSets (PEveSOFDataHullLightSetVector) [READ, PERSIST] */

  @type.list("EveSOFDataHullLightSet")
  lightSets = [];

  /** m_opaqueAreas (PEveSOFDataHullAreaVector) [READ, PERSIST] */

  @type.list("EveSOFDataHullArea")
  opaqueAreas = [];

  /** m_planeSets (PEveSOFDataHullPlaneSetVector) [READ, PERSIST] */

  @type.list("EveSOFDataHullPlaneSet")
  planeSets = [];

  /** m_geometryResFilePath (std::string) [READWRITE, PERSIST] */

  @type.path("TriGeometryRes")
  geometryResFilePath = "";

  /** m_spotlightSets (PEveSOFDataHullSpotlightSetVector) [READ, PERSIST] */

  @type.list("EveSOFDataHullSpotlightSet")
  spotlightSets = [];

  /** m_spriteLineSets (PEveSOFDataHullSpriteLineSetVector) [READ, PERSIST] */

  @type.list("EveSOFDataHullSpriteLineSet")
  spriteLineSets = [];

  /** m_spriteSets (PEveSOFDataHullSpriteSetVector) [READ, PERSIST] */

  @type.list("EveSOFDataHullSpriteSet")
  spriteSets = [];

  /** m_transparentAreas (PEveSOFDataHullAreaVector) [READ, PERSIST] */

  @type.list("EveSOFDataHullArea")
  transparentAreas = [];

  /** m_locatorTurrets (PEveSOFDataHullLocatorVector) [READ, PERSIST] */

  @type.list("EveSOFDataHullLocator")
  locatorTurrets = [];

  /** m_sof6 (bool) [READWRITE, PERSIST] */

  @type.boolean
  sof6 = false;

  /** m_enableDynamicBoundingSphere (bool) [READWRITE, PERSIST] */

  @type.boolean
  enableDynamicBoundingSphere = false;

  /** m_castShadow (bool) [READWRITE, PERSIST] */

  @type.boolean
  castShadow = true;

}

// Native chooser labels and selection; the enum object retains all C++ members.
blue.enums.Create("trinity.EveSOFDataHull.BuildClass", EveSOFDataHull.BuildClass, {
  exposedName: "BuildClass", exposure: EnumRegistrationType.ENUM_REG_ENUM_OBJECT_ON_MODULE,
  chooser: [
    { name: "EveShip2", value: EveSOFDataHull.BuildClass.BUILDCLASS_SHIP, description: "Build an EveShip2" },
    { name: "EveMobile", value: EveSOFDataHull.BuildClass.BUILDCLASS_MOBILE, description: "Build an EveMobile" },
    { name: "EveStation2", value: EveSOFDataHull.BuildClass.BUILDCLASS_STATIONARY, description: "Build an EveStation2" },
    { name: "EveSwarm", value: EveSOFDataHull.BuildClass.BUILDCLASS_SWARM, description: "Build an EveSwarm" },
    { name: "Extension", value: EveSOFDataHull.BuildClass.BUILDCLASS_EXTENSION, description: "Build an EveEffectRoot with a child" }
  ]
});

// Native chooser labels and selection; the enum object retains all C++ members.
blue.enums.Create("trinity.EveSOFDataHull.ImpactEffectType", EveSOFDataHull.ImpactEffectType, {
  exposedName: "ImpactEffectType", exposure: EnumRegistrationType.ENUM_REG_ENUM_OBJECT_ON_MODULE,
  chooser: [
    { name: "Nothing", value: EveSOFDataHull.ImpactEffectType.IMPACTEFFECT_NONE, description: "No impact effects" },
    { name: "Ellipsoid", value: EveSOFDataHull.ImpactEffectType.IMPACTEFFECT_ELLIPSOID, description: "Use ellipsoid for shield" },
    { name: "Hull", value: EveSOFDataHull.ImpactEffectType.IMPACTEFFECT_HULL, description: "Use ellipsoid for hull" }
  ]
});
