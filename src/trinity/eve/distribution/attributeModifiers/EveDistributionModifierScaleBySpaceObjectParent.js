// Source: trinity/trinity/Eve/SpaceObject/Utils/EveDistributionMethods/DistributionAttributeModifiers/EveDistributionModifierScaleBySpaceObjectParent.h
import { exposure as be } from "#be";
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type } from "#schema";
import { IEveDistributionModifier } from "./IEveDistributionModifier.js";
import { sph3 } from "#math/sph3";
import { vec3 } from "#math/vec3";

/** Multiplies a distributed placement's additional scale from its parent space object's bounding radius or an authored scale curve. */
@be.define({
  name: "EveDistributionModifierScaleBySpaceObjectParent",
  // EveDistributionModifierScaleBySpaceObjectParent_Blue.cpp:11-17, in Carbon's order.
  interfaces: [ IEveDistributionModifier ],
  members: [
    [ be.ATTR, "authoredForBoundingRadius", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "scaleFactor", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "scaleCurve", be.READWRITE | be.PERSIST ]
  ]
})
export class EveDistributionModifierScaleBySpaceObjectParent extends IEveDistributionModifier
{

  /** m_scaleFactor (float) [READWRITE, PERSIST] */

  @type.float32
  scaleFactor = 1;

  /** m_authoredForBoundingRadius (float) [READWRITE, PERSIST] */

  @type.float32
  authoredForBoundingRadius = 1000;

  /** m_scaleCurve (ITriVectorFunctionPtr) [READWRITE, PERSIST] */

  @type.object.ref("ITriVectorFunction")
  scaleCurve = null;

  /**
   * Reports a transform effect whenever a non-zero scale factor is authored.
   *
   * @implemented
   */

  AffectsTransform()
  {
    return this.scaleFactor !== 0;
  }

  /**
   * Scales a placement by the size of the parent space object: the parent's bounding-sphere radius either samples scaleCurve or, without a curve, forms a scaleFactor-shaped ratio against authoredForBoundingRadius, and the result multiplies into the placement's additional scale rather than replacing it. Does nothing when the update params carry no space-object parent.
   *
   * @adapted
   * @returns {number} Always DO_NOTHING; this modifier never ends an entity's life.
   */

  ProcessDistributionModifier(placement, _deltaTime, params)
  {
    if (!params.spaceObjectParent)
    {
      return 0;
    }

    const bounds = sph3.create();
    params.spaceObjectParent.GetBoundingSphere(bounds);
    if (this.scaleCurve)
    {
      const finalScale = vec3.create();
      this.scaleCurve.GetValueAt(bounds[3], finalScale);
      vec3.multiply(placement.additionalScale, placement.additionalScale, finalScale);
    }
    else
    {
      const assetRatio = bounds[3] / Math.max(this.authoredForBoundingRadius, 1);
      const finalScale = assetRatio > 1
        ? 1 + this.scaleFactor * (assetRatio - 1)
        : Math.pow(assetRatio, this.scaleFactor);
      vec3.scale(placement.additionalScale, placement.additionalScale, finalScale);
    }
    return 0;
  }

}
