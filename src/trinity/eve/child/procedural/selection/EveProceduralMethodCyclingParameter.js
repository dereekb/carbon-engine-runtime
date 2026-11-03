import { IRoot } from "../../../../../blue/exposure/IRoot.js";
import { exposure as be } from "#be";
// Source: trinity/trinity/Eve/SpaceObject/Children/ProceduralContainer/SelectionMethods/EveProceduralMethodCyclingParameter.h
import { IsMatch, INotify } from "#blue";
import { IInitialize } from "../../../../../blue/exposure/IInitialize.js";
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type } from "#schema";
import { EveChildRef } from "../../../../eve/child/EveChildRef.js";

/** EveProceduralMethodCyclingParameter (eve/child/procedural/selection) - generated from schema shapeHash 90bcbbe1.... */
@be.define({
  name: "EveProceduralMethodCyclingParameter",
  inherit: [ INotify, IInitialize ],
  // EveProceduralMethodCyclingParameter_Blue.cpp:10-19, in Carbon's order.
  interfaces: [ INotify, IInitialize ],
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "child", be.READWRITE | be.PERSIST | be.NOTIFY ],
    [ be.ATTR, "playDuration", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "restartRequired", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "reloadRequired", be.READWRITE | be.PERSIST ]
  ]
})
export class EveProceduralMethodCyclingParameter extends IRoot
{

  _modified = false;

  // Carbon m_hasLoaded: runtime-only load latch (never persisted).
  _hasLoaded = false;

  /** m_child (EveChildRefPtr) [READWRITE, PERSIST, NOTIFY] */


  @type.object.ref("EveChildRef")
  child = null;

  /** m_name (BlueSharedString) [READWRITE, PERSIST] */

  @type.string
  name = "";

  /** m_playDuration (float) [READWRITE, PERSIST] */

  @type.float32
  playDuration = 1;

  /** m_reloadRequired (bool) [READWRITE, PERSIST] */

  @type.boolean
  reloadRequired = false;

  /** m_restartRequired (bool) [READWRITE, PERSIST] */

  @type.boolean
  restartRequired = true;

  /**
   * Carbon EveProceduralMethodCyclingParameter::Initialize (cpp:19-26):
   * lazily create the child ref.
   *
   * @implemented
   */

  Initialize()
  {
    if (!this.child)
    {
      this.child = new EveChildRef();
    }
    return true;
  }

  /**
   * Carbon EveProceduralMethodCyclingParameter::OnModified (cpp:28-39): a
   * child assignment blocks its auto-load until the cycle selects it. The
   * value argument follows the repo's OnModified duck.
   *
   * @implemented
   */

  OnModified(value = null)
  {
    if (IsMatch(value, "child"))
    {
      if (this.child)
      {
        this.child.SetAutoLoadBlocker(true);
      }
    }

    return true;
  }

  /**
   * Carbon method SetModified (cpp:41-44).
   *
   * @implemented
   */

  SetModified(isModified)
  {
    this._modified = !!isModified;
  }

  /**
   * Carbon method IsModified (cpp:46-49).
   *
   * @implemented
   */

  IsModified()
  {
    return this._modified;
  }

  /**
   * Carbon method GetName (cpp:51-54).
   *
   * @implemented
   */

  GetName()
  {
    return this.name;
  }

  /**
   * Carbon method GetChild (cpp:56-59).
   *
   * @implemented
   */

  GetChild()
  {
    return this.child;
  }

  /**
   * Carbon method GetDuration (cpp:61-64).
   *
   * @implemented
   */

  GetDuration()
  {
    return this.playDuration;
  }

  /**
   * Carbon EveProceduralMethodCyclingParameter::Load (cpp:66-83): an
   * already-loaded parameter that needs no reload only restarts its
   * controllers/curve sets when required; otherwise the child ref reloads
   * with the auto-load blocker bypassed.
   *
   * @implemented
   */

  Load()
  {
    if (this._hasLoaded && !this.reloadRequired)
    {
      if (this.restartRequired)
      {
        this.child.StartControllers();
        this.child.PlayAllCurveSets();
      }
      return;
    }

    if (this.child)
    {
      this.child.Reload(true);
      this._hasLoaded = true;
    }
  }

}
