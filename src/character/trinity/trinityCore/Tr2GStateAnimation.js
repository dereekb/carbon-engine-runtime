import { IRoot } from "../../../blue/blueexposure/IRoot.js";
import { exposure as be } from "#be";
import { IInitialize } from "#blueexposure/IInitialize";
import { ITr2AnimationUpdater } from "../../../trinity/core/animation/ITr2AnimationUpdater.js";
// Source: trinity/trinity/Tr2GStateAnimation.h
import { type } from "#schema";

/** Character GState animation record for an external state-machine adapter. */
@be.define({
  name: "Tr2GStateAnimation",
  inherit: [ IInitialize, ITr2AnimationUpdater ],
  // Tr2GStateAnimation_Blue.cpp:16-255, in Carbon's order.
  interfaces: [ IInitialize, ITr2AnimationUpdater ],
  members: [
    [ be.PROP, "resPath" ],
    [ be.ATTR, "resPath_", be.PERSISTONLY ],
    [ be.PROP, "gStateResPath" ],
    [ be.ATTR, "gStateResPath_", be.PERSISTONLY ],
    [ be.ATTR, "grannyRes", be.READ ],
    [ be.PROP, "model" ],
    [ be.ATTR, "model_", be.PERSISTONLY ],
    [ be.ATTR, "parameters", be.READ | be.PERSIST ],
    [ be.ATTR, "debugRenderSkeleton", be.READWRITE ],
    [ be.ATTR, "debugRenderJointNames", be.READWRITE ],
    [ be.ATTR, "animationEnabled", be.READWRITE ],
    [ be.ATTR, "eventListener", be.READWRITE ],
    [ be.METHOD, "TogglePauseAnimations", be.WRAP ],
    [ be.METHOD, "LoadModelFromGstate", be.WRAP ],
    [ be.METHOD, "GetGStateAnimFileRefPaths", be.WRAP ],
    [ be.METHOD, "GetTopLevelNodeNames", be.WRAP ],
    [ be.METHOD, "GetTopLevelParameterNodeNames", be.WRAP ],
    [ be.METHOD, "GetTopLevelStateNodeNames", be.WRAP ],
    [ be.METHOD, "GetParameters", be.WRAP ],
    [ be.METHOD, "GetParameterRange", be.WRAP ],
    [ be.METHOD, "GetActiveMachineElementName", be.WRAP ],
    [ be.METHOD, "GetStartStateIdx", be.WRAP ],
    [ be.METHOD, "SetStartStateIdx", be.WRAP ],
    [ be.METHOD, "SetStartStateByName", be.WRAP ],
    [ be.METHOD, "RequestChangeToState", be.WRAP ],
    [ be.METHOD, "ForceChangeToState", be.WRAP ],
    [ be.METHOD, "StartTransitionByName", be.WRAP ],
    [ be.METHOD, "GetParameter", be.WRAP ],
    [ be.METHOD, "SetParameter", be.WRAP ],
    [ be.METHOD, "RequestParameter", be.WRAP ],
    [ be.METHOD, "RequestParameterByName", be.WRAP ],
    [ be.METHOD, "GetParameterByName", be.WRAP ],
    [ be.METHOD, "GetParameterIndexByName", be.WRAP ],
    [ be.METHOD, "IsFullyLoaded", be.WRAP ],
    [ be.METHOD, "InstantiateCharacter", be.WRAP ],
    [ be.METHOD, "ResetParamsToDefault", be.WRAP ],
    [ be.METHOD, "GetAnimationTime", be.WRAP ],
    [ be.METHOD, "StartScrub", be.WRAP ],
    [ be.METHOD, "ClearScrub", be.WRAP ],
    [ be.METHOD, "PlayFromScrub", be.WRAP ],
    [ be.METHOD, "StopPlayFromScrub", be.WRAP ],
    [ be.METHOD, "GetScrubOffset", be.WRAP ],
    [ be.METHOD, "SetScrubOffset", be.WRAP ]
  ]
})
export class Tr2GStateAnimation extends IRoot
{

  /** m_resPath (std::string) [PERSISTONLY] */
  @type.string
  resPath_ = "";

  /** m_gStateResPath (std::string) [PERSISTONLY] */
  @type.string
  gStateResPath_ = "";

  /** m_model (std::string) [PERSISTONLY] */
  @type.string
  model_ = "";

  /** m_gStateParameterList (PTr2GStateParameterVector) [READ, PERSIST] */
  @type.list("Tr2GStateParameter")
  parameters = [];

  /** m_grannyRes (TriGrannyResPtr) [READ] */
  @type.object.ref("TriGrannyRes")
  grannyRes = null;

  /** m_eventListener (IBlueEventListenerPtr) [READWRITE] */
  @type.object.ref("IBlueEventListener")
  eventListener = null;

  /** m_animationEnabled (bool) [READWRITE] */
  @type.boolean
  animationEnabled = true;

  /** m_debugRenderJointNames (bool) [READWRITE] */
  @type.boolean
  debugRenderJointNames = false;

  /** m_debugRenderSkeleton (bool) [READWRITE] */
  @type.boolean
  debugRenderSkeleton = false;

  /**
   * Returns the authored Granny animation resource path stored by this graph
   * shell.
   */
  @type.string
  get resPath()
  {
    return this.GetResPath();
  }

  /**
   * Stores an authored Granny animation resource path without acquiring its
   * resource.
   */
  set resPath(value)
  {
    this.SetResPath(value);
  }

  /** Returns the authored state-graph resource path stored by this graph shell. */
  @type.string
  get gStateResPath()
  {
    return this.GetGStateResPath();
  }

  /**
   * Stores an authored state-graph resource path without loading or evaluating
   * it.
   */
  set gStateResPath(value)
  {
    this.SetGStateResPath(value);
  }

  /** Returns the authored Granny model name stored by this graph shell. */
  @type.string
  get model()
  {
    return this.GetModel();
  }

  /**
   * Stores an authored Granny model name without instantiating native model
   * state.
   */
  set model(value)
  {
    this.SetModel(value);
  }

  /**
   * Returns the persisted Granny animation path without resolving a resource.
   *
   * @implemented
   */
  GetResPath()
  {
    return this.resPath_;
  }

  /**
   * Persists the authored Granny animation path for an external resource
   * adapter.
   *
   * @adapted Stores the authored path; Granny resource loading belongs to the
   *   resource/state-machine adapter.
   */
  SetResPath(value)
  {
    this.resPath_ = String(value ?? "");
  }

  /**
   * Returns the persisted state-graph path without resolving a resource.
   *
   * @implemented
   */
  GetGStateResPath()
  {
    return this.gStateResPath_;
  }

  /**
   * Persists the authored state-graph path for an external state-machine
   * adapter.
   *
   * @adapted Stores the authored path; state-graph loading belongs to the
   *   resource/state-machine adapter.
   */
  SetGStateResPath(value)
  {
    this.gStateResPath_ = String(value ?? "");
  }

  /**
   * Returns the persisted authored model name without instantiating it.
   *
   * @implemented
   */
  GetModel()
  {
    return this.model_;
  }

  /**
   * Persists the authored model name for an external Granny runtime adapter.
   *
   * @adapted Stores the authored model name; native model instantiation belongs to the
   *   Granny runtime adapter.
   */
  SetModel(value)
  {
    this.model_ = String(value ?? "");
  }

  /**
   * Carbon method ClearScrub (MAP_METHOD_AND_WRAP).
   *
   * @notImplemented
   */
  ClearScrub(...args)
  {
    throw new Error("Tr2GStateAnimation.ClearScrub is not implemented in CarbonEngineJS.");
  }

  /**
   * Carbon method ForceChangeToState (MAP_METHOD_AND_WRAP).
   *
   * @notImplemented
   */
  ForceChangeToState(...args)
  {
    throw new Error("Tr2GStateAnimation.ForceChangeToState is not implemented in CarbonEngineJS.");
  }

  /**
   * Carbon method GetActiveMachineElementName (MAP_METHOD_AND_WRAP).
   *
   * @notImplemented
   */
  GetActiveMachineElementName(...args)
  {
    throw new Error("Tr2GStateAnimation.GetActiveMachineElementName is not implemented in CarbonEngineJS.");
  }

  /**
   * Carbon method GetAnimationTime (MAP_METHOD_AND_WRAP).
   *
   * @notImplemented
   */
  GetAnimationTime(...args)
  {
    throw new Error("Tr2GStateAnimation.GetAnimationTime is not implemented in CarbonEngineJS.");
  }

  /**
   * Carbon method GetGStateAnimFileRefPaths (MAP_METHOD_AND_WRAP).
   *
   * @notImplemented
   */
  GetGStateAnimFileRefPaths(...args)
  {
    throw new Error("Tr2GStateAnimation.GetGStateAnimFileRefPaths is not implemented in CarbonEngineJS.");
  }

  /**
   * Carbon method GetParameter (MAP_METHOD_AND_WRAP).
   *
   * @notImplemented
   */
  GetParameter(...args)
  {
    throw new Error("Tr2GStateAnimation.GetParameter is not implemented in CarbonEngineJS.");
  }

  /**
   * Carbon method GetParameterByName (MAP_METHOD_AND_WRAP).
   *
   * @notImplemented
   */
  GetParameterByName(...args)
  {
    throw new Error("Tr2GStateAnimation.GetParameterByName is not implemented in CarbonEngineJS.");
  }

  /**
   * Carbon method GetParameterIndexByName (MAP_METHOD_AND_WRAP).
   *
   * @notImplemented
   */
  GetParameterIndexByName(...args)
  {
    throw new Error("Tr2GStateAnimation.GetParameterIndexByName is not implemented in CarbonEngineJS.");
  }

  /**
   * Carbon method GetParameterRange (MAP_METHOD_AND_WRAP).
   *
   * @notImplemented
   */
  GetParameterRange(...args)
  {
    throw new Error("Tr2GStateAnimation.GetParameterRange is not implemented in CarbonEngineJS.");
  }

  /**
   * Carbon method GetParameters (MAP_METHOD_AND_WRAP).
   *
   * @notImplemented
   */
  GetParameters(...args)
  {
    throw new Error("Tr2GStateAnimation.GetParameters is not implemented in CarbonEngineJS.");
  }

  /**
   * Carbon method GetScrubOffset (MAP_METHOD_AND_WRAP).
   *
   * @notImplemented
   */
  GetScrubOffset(...args)
  {
    throw new Error("Tr2GStateAnimation.GetScrubOffset is not implemented in CarbonEngineJS.");
  }

  /**
   * Carbon method GetStartStateIdx (MAP_METHOD_AND_WRAP).
   *
   * @notImplemented
   */
  GetStartStateIdx(...args)
  {
    throw new Error("Tr2GStateAnimation.GetStartStateIdx is not implemented in CarbonEngineJS.");
  }

  /**
   * Carbon method GetTopLevelNodeNames (MAP_METHOD_AND_WRAP).
   *
   * @notImplemented
   */
  GetTopLevelNodeNames(...args)
  {
    throw new Error("Tr2GStateAnimation.GetTopLevelNodeNames is not implemented in CarbonEngineJS.");
  }

  /**
   * Carbon method GetTopLevelParameterNodeNames (MAP_METHOD_AND_WRAP).
   *
   * @notImplemented
   */
  GetTopLevelParameterNodeNames(...args)
  {
    throw new Error("Tr2GStateAnimation.GetTopLevelParameterNodeNames is not implemented in CarbonEngineJS.");
  }

  /**
   * Carbon method GetTopLevelStateNodeNames (MAP_METHOD_AND_WRAP).
   *
   * @notImplemented
   */
  GetTopLevelStateNodeNames(...args)
  {
    throw new Error("Tr2GStateAnimation.GetTopLevelStateNodeNames is not implemented in CarbonEngineJS.");
  }

  /**
   * Carbon method InstantiateCharacter (MAP_METHOD_AND_WRAP).
   *
   * @notImplemented
   */
  InstantiateCharacter(...args)
  {
    throw new Error("Tr2GStateAnimation.InstantiateCharacter is not implemented in CarbonEngineJS.");
  }

  /**
   * Carbon method IsFullyLoaded (MAP_METHOD_AND_WRAP).
   *
   * @notImplemented
   */
  IsFullyLoaded(...args)
  {
    throw new Error("Tr2GStateAnimation.IsFullyLoaded is not implemented in CarbonEngineJS.");
  }

  /**
   * Carbon method LoadModelFromGstate (MAP_METHOD_AND_WRAP).
   *
   * @notImplemented
   */
  LoadModelFromGstate(...args)
  {
    throw new Error("Tr2GStateAnimation.LoadModelFromGstate is not implemented in CarbonEngineJS.");
  }

  /**
   * Carbon method PlayFromScrub (MAP_METHOD_AND_WRAP).
   *
   * @notImplemented
   */
  PlayFromScrub(...args)
  {
    throw new Error("Tr2GStateAnimation.PlayFromScrub is not implemented in CarbonEngineJS.");
  }

  /**
   * Carbon method RequestChangeToState (MAP_METHOD_AND_WRAP).
   *
   * @notImplemented
   */
  RequestChangeToState(...args)
  {
    throw new Error("Tr2GStateAnimation.RequestChangeToState is not implemented in CarbonEngineJS.");
  }

  /**
   * Carbon method RequestParameter (MAP_METHOD_AND_WRAP).
   *
   * @notImplemented
   */
  RequestParameter(...args)
  {
    throw new Error("Tr2GStateAnimation.RequestParameter is not implemented in CarbonEngineJS.");
  }

  /**
   * Carbon method RequestParameterByName (MAP_METHOD_AND_WRAP).
   *
   * @notImplemented
   */
  RequestParameterByName(...args)
  {
    throw new Error("Tr2GStateAnimation.RequestParameterByName is not implemented in CarbonEngineJS.");
  }

  /**
   * Carbon method ResetParamsToDefault (MAP_METHOD_AND_WRAP).
   *
   * @notImplemented
   */
  ResetParamsToDefault(...args)
  {
    throw new Error("Tr2GStateAnimation.ResetParamsToDefault is not implemented in CarbonEngineJS.");
  }

  /**
   * Carbon method SetParameter (MAP_METHOD_AND_WRAP).
   *
   * @notImplemented
   */
  SetParameter(...args)
  {
    throw new Error("Tr2GStateAnimation.SetParameter is not implemented in CarbonEngineJS.");
  }

  /**
   * Carbon method SetScrubOffset (MAP_METHOD_AND_WRAP).
   *
   * @notImplemented
   */
  SetScrubOffset(...args)
  {
    throw new Error("Tr2GStateAnimation.SetScrubOffset is not implemented in CarbonEngineJS.");
  }

  /**
   * Carbon method SetStartStateByName (MAP_METHOD_AND_WRAP).
   *
   * @notImplemented
   */
  SetStartStateByName(...args)
  {
    throw new Error("Tr2GStateAnimation.SetStartStateByName is not implemented in CarbonEngineJS.");
  }

  /**
   * Carbon method SetStartStateIdx (MAP_METHOD_AND_WRAP).
   *
   * @notImplemented
   */
  SetStartStateIdx(...args)
  {
    throw new Error("Tr2GStateAnimation.SetStartStateIdx is not implemented in CarbonEngineJS.");
  }

  /**
   * Carbon method StartScrub (MAP_METHOD_AND_WRAP).
   *
   * @notImplemented
   */
  StartScrub(...args)
  {
    throw new Error("Tr2GStateAnimation.StartScrub is not implemented in CarbonEngineJS.");
  }

  /**
   * Carbon method StartTransitionByName (MAP_METHOD_AND_WRAP).
   *
   * @notImplemented
   */
  StartTransitionByName(...args)
  {
    throw new Error("Tr2GStateAnimation.StartTransitionByName is not implemented in CarbonEngineJS.");
  }

  /**
   * Carbon method StopPlayFromScrub (MAP_METHOD_AND_WRAP).
   *
   * @notImplemented
   */
  StopPlayFromScrub(...args)
  {
    throw new Error("Tr2GStateAnimation.StopPlayFromScrub is not implemented in CarbonEngineJS.");
  }

  /**
   * Carbon method TogglePauseAnimations (MAP_METHOD_AND_WRAP).
   *
   * @notImplemented
   */
  TogglePauseAnimations(...args)
  {
    throw new Error("Tr2GStateAnimation.TogglePauseAnimations is not implemented in CarbonEngineJS.");
  }

}
