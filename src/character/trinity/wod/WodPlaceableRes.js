// Source: trinity/trinity/Wod/WodPlaceableRes.h
// Source: trinity/trinity/Wod/WodPlaceableRes.cpp
// Source: trinity/trinity/Wod/WodPlaceableRes_Blue.cpp
import { exposure as be } from "#be";
import { type } from "#schema";
import { IRoot } from "#blue";
import { vec3 } from "#math/vec3";

/** Authored placeable geometry, animations, fade distances and cached bounds. */
@be.define({
  name: "WodPlaceableRes",
  inherit: [ IRoot ],
  // WodPlaceableRes_Blue.cpp:11-20, in Carbon's order.
  members: [
    [ be.ATTR, "visualModel", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "farFadeDistance", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "nearFadeDistance", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "curveSets", be.READ | be.PERSIST ],
    [ be.ATTR, "isShadowCaster", be.READWRITE | be.PERSIST ]
  ]
})

export class WodPlaceableRes
{
  /** Native visual model. */

  @type.object.ref("Tr2Model")
  visualModel = null;

  /** Native squared far fade distance. */

  @type.float32
  farFadeDistance = 10000;

  /** Native squared near fade distance. */

  @type.float32
  nearFadeDistance = 2500;

  /** Curves animating the placeable graph. */

  @type.list("TriCurveSet")
  curveSets = [];

  /** Whether this resource participates in shadow casting. */

  @type.boolean
  isShadowCaster = true;

  _minBounds = vec3.create();
  _maxBounds = vec3.create();
  _isReady = false;

  /**
   * Returns the squared near fade distance.
   *
   * @implemented
   */

  GetNearFadeDistance()
  {
    return this.nearFadeDistance;
  }

  /**
   * Returns the squared far fade distance.
   *
   * @implemented
   */

  GetFarFadeDistance()
  {
    return this.farFadeDistance;
  }

  /**
   * Returns the visual model.
   *
   * @implemented
   */

  GetVisualModel()
  {
    return this.visualModel;
  }

  /**
   * Returns the live curve set collection.
   *
   * @implemented
   */

  GetCurveSets()
  {
    return this.curveSets;
  }

  /**
   * Returns the native shadow-caster flag.
   *
   * @implemented
   */

  IsShadowCaster()
  {
    return this.isShadowCaster;
  }

  /**
   * Delegates batch construction to the assigned model.
   * Carbon declaration: WodPlaceableRes::GetBatches (trinity/trinity/Wod/WodPlaceableRes.h:35).
   *
   * @implemented
   */
  GetBatches(batches, batchType, matrix, data)
  {
    if (this.visualModel) this.visualModel.GetBatches(batches, batchType, matrix, data);
  }

  /**
   * Reports transparent areas, including hidden meshes as Carbon does.
   *
   * @implemented
   */

  HasTransparency()
  {
    return this.visualModel ? this.visualModel.HasTransparency() : false;
  }

  /**
   * Caches bounds once every model mesh is ready. Carbon requires a visualModel
   * here; an incomplete authored graph is a contract error, not a ready resource.
   * Subsequent calls retain the native cache even if visualModel changes.
   *
   * @implemented
   */

  IsReady()
  {
    if (this._isReady) return true;
    if (!this.visualModel.GetBoundingBox(this._minBounds, this._maxBounds)) return false;
    this._isReady = true;
    return true;
  }

  /**
   * Copies cached bounds, attempting readiness first as in the native header.
   *
   * @implemented
   */

  GetBoundingBox(min, max)
  {
    this.IsReady();
    vec3.copy(min, this._minBounds);
    vec3.copy(max, this._maxBounds);
  }
}

