import { blue } from "#blue";
import { IRoot } from "../../../blue/exposure/IRoot.js";
import { exposure as be } from "#be";
// Source: trinity/trinity/Curves/Tr2GrannyTrack.h
// Source: trinity/trinity/Curves/Tr2GrannyTrack.cpp
import { IsMatch } from "#blue";
import { IInitialize } from "../../../blue/exposure/IInitialize.js";
import { CjsSchema, meta, type } from "#schema";
import { INotify, ITriFunction, ITriCurveLength } from "#blue";
import { CjsGrannyCurves } from "./CjsGrannyCurves.js";
import { TriGrannyRes } from "../../resources/geometry/granny/TriGrannyRes.js";


/**
 * Base for curves sampled out of a Granny animation resource, owning the
 * resource path, group and track name plus the cycle flag and resolved duration;
 * subclasses supply the track binding and sampling.
 *
 * @abstract
 */
@be.define({
  name: "Tr2GrannyTrack",
  inherit: [ ITriFunction, IInitialize, ITriCurveLength, INotify ],
  // Tr2GrannyTrack_Blue.cpp:11-21, in Carbon's order.
  interfaces: [ ITriFunction, IInitialize, INotify ],
  members: [
    [ be.ATTR_CHOOSER, "grannyResPath", be.READWRITE | be.PERSIST | be.NOTIFY, "blue.TriGR2Chooser" ],
    [ be.ATTR, "grannyRes", be.READ ],
    [ be.ATTR, "name", be.READWRITE | be.PERSIST | be.NOTIFY ],
    [ be.ATTR, "group", be.READWRITE | be.PERSIST | be.NOTIFY ],
    [ be.ATTR, "duration", be.READ ],
    [ be.ATTR, "cycle", be.READWRITE | be.PERSIST ]
  ]
})
@be.abstract
export class Tr2GrannyTrack extends IRoot
{
  /** Carbon: MAP_ATTRIBUTE_WITH_CHOOSER (trinity/trinity/Curves/Tr2GrannyTrack_Blue.cpp:16); chooser TriGR2Chooser (trinity/trinity/TriConstants.cpp:87). */
  @type.path
  grannyResPath = "";

  @type.boolean
  cycle = false;

  @type.float32
  duration = 0;

  /** m_grannyRes (TriGrannyResPtr) [READ] */
  @type.object.ref("TriGrannyRes")
  get grannyRes() { return this._grannyRes; }

  /**
   * Moves the notification link with the resource.
   * @adapted Tr2GrannyTrack.cpp:88-106 uses native targets; ours live on resMan.
   *   A decoded source from the registry has no lifetime and stays unregistered.
   */
  set grannyRes(resource)
  {
    if (resource === this._grannyRes) return;

    const previous = this._grannyLink;
    if (previous) blue.resMan.notify.Remove(this, previous);

    this._grannyRes = resource;
    this._grannyLink = CjsSchema.cast(resource, TriGrannyRes);
    this._grannyNeedsReload = !!previous && !resource;
    if (this._grannyLink) blue.resMan.notify.Add(this, this._grannyLink, this, "grannyRes");
  }

  /** Resource storage behind the notification-aware property. */
  _grannyRes = null;

  /** @cjs The TriGrannyRes this track is linked to, null for a decoded source. */
  _grannyLink = null;

  /** @cjs The resource expired while the path stands, so use reloads it. */
  _grannyNeedsReload = false;


  @type.string
  name = "";


  @type.string
  group = "";

  /**
   * Initializes the resource-backed track.
   *
   * @adapted
   */

  Initialize()
  {
    this.SetGrannyResource();
    return true;
  }

  /**
   * Carbon OnModified (Tr2GrannyTrack.cpp:49-65): a new resource path relinks
   * the resource; a new name or group rebuilds the curves. The two checks are
   * independent, so a batched change runs both.
   *
   * @implemented
   */

  OnModified(propertyName)
  {
    if (IsMatch(propertyName, "grannyResPath")) this.SetGrannyResource();
    if (IsMatch(propertyName, "name") || IsMatch(propertyName, "group"))
    {
      this.ResetTracks();
      this.duration = 0;
      this.SetCurves();
    }
    return true;
  }

  /**
   * Carbon ReleaseCachedData (Tr2GrannyTrack.cpp:68-75): the tracks go with the
   * resource.
   *
   * @implemented
   * @param {TriGrannyRes|null} resource Resource losing its data.
   */

  ReleaseCachedData(resource)
  {
    if (resource === this.grannyRes)
    {
      this.duration = 0;
      this.ResetTracks();
    }
  }

  /**
   * Carbon RebuildCachedData (Tr2GrannyTrack.cpp:78-84): binds the tracks once
   * the resource is good.
   *
   * @implemented
   * @param {TriGrannyRes} resource Resource that finished preparing.
   */

  RebuildCachedData(resource)
  {
    if (resource === this.grannyRes && resource.IsGood()) this.SetCurves();
  }

  /**
   * Relinks the authored Granny resource path.
   *
   * Carbon: Tr2GrannyTrack::SetGrannyResource (Tr2GrannyTrack.cpp:86-107). The
   * link's registration rebuilds a prepared resource at once, as AddNotifyTarget
   * does, and a resource still loading binds through RebuildCachedData.
   *
   * @adapted Tracks reset first, because a rebind here can follow a bound
   *   resource. The decoded registry answers before resMan for hosts that
   *   registered a source, and such a source has no notification to wait for.
   */

  SetGrannyResource()
  {
    this.ResetTracks();
    this.duration = 0;
    this.grannyRes = null;
    this._grannyNeedsReload = false;

    if (!this.grannyResPath)
    {
      this.ReleaseCachedData(this.grannyRes);
      return;
    }

    this.grannyRes = CjsGrannyCurves.resolveResource(this.grannyResPath) ?? blue.resMan.GetResource(this.grannyResPath, { ex: "raw" });
    if (!this._grannyLink) this.SetCurves();
  }

  /**
   * Updates the track value.
   *
   * @adapted Ours: JavaScript links expire without use where Carbon's reference
   *   keeps the resource, so use renews the link and reloads an expired resource.
   */

  UpdateValue(time)
  {
    if (this._grannyNeedsReload) this.SetGrannyResource();
    if (this._grannyLink) this._grannyLink.IsGood(this);

    if (!this.TracksReady())
    {
      return;
    }
    const duration = this.Length();
    const localTime = this.cycle && duration > 0 ? time % duration : time;
    if (localTime >= 0 && localTime <= duration)
    {
      this.UpdateValueImpl(localTime);
    }
  }

  /**
   * Gets track duration.
   *
   * @implemented
   */

  Length()
  {
    return Number(this.duration) || 0;
  }

  /**
   * Carbon destructor (Tr2GrannyTrack.cpp:14-21): drops the notification link.
   *
   * @adapted JavaScript has no destructor, so owners call this.
   */
  Destruct()
  {
    this.grannyRes = null;
    this._grannyNeedsReload = false;
  }

  /**
   * Locates resource curves.
   *
   * @adapted
   */

  SetCurves()
  {
    if (!this.name || !this.group)
    {
      return;
    }
    // Carbon reads m_grannyRes->GetGrannyFile() (Tr2GrannyTrack.cpp:116).
    const source = CjsGrannyCurves.getTrackSource(this._grannyLink ? this._grannyLink.GetGrannyFile() : this.grannyRes);
    if (!source)
    {
      return;
    }
    for (const animation of CjsGrannyCurves.getAnimations(source))
    {
      for (const trackGroup of CjsGrannyCurves.getTrackGroups(animation))
      {
        const groupName = trackGroup.name ?? trackGroup.Name;
        if (groupName === this.group)
        {
          this.ApplyTracks(trackGroup, CjsGrannyCurves.getAnimationDuration(animation), CjsGrannyCurves.getAnimationTimeStep(animation));
          return;
        }
      }
    }
  }

  /**
   * Carbon's pure virtual `UpdateValueImpl( double time )` (Tr2GrannyTrack.h:86):
   * the subclass samples its tracks at a local time.
   *
   * @abstract
   * @param {number} _time Local time in seconds.
   */
  @meta.abstract
  UpdateValueImpl(_time) {}

  /**
   * Carbon's pure virtual `ResetTracks( void )` (Tr2GrannyTrack.h:87): the
   * subclass drops its resource track handles.
   *
   * @abstract
   */
  @meta.abstract
  ResetTracks() {}

  /**
   * Carbon's pure virtual `ApplyTracks( granny_track_group* group, float
   * duration, float timeStep )` (Tr2GrannyTrack.h:88): the subclass binds its
   * tracks from the named group.
   *
   * @abstract
   * @param {object} _group The decoded track group.
   * @param {number} _duration Animation duration in seconds.
   * @param {number} _timeStep Animation time step in seconds.
   */
  @meta.abstract
  ApplyTracks(_group, _duration, _timeStep) {}

  /**
   * Carbon's pure virtual `TracksReady( void )` (Tr2GrannyTrack.h:89).
   *
   * @abstract
   * @returns {boolean} Whether the subclass's track handles are bound.
   */
  @meta.abstract
  TracksReady() {}
}
