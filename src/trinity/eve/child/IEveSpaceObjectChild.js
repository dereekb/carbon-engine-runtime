// Source: trinity/trinity/Eve/SpaceObject/Children/IEveSpaceObjectChild.h
import { exposure as be } from "#be";
import { Origin } from "../../generated/eve/child/enums.js";
import { EveEntity } from "../EveEntity.js";


/**
 * Deprecated compatibility identity retained for older serialized and Python
 * type names. New code uses EveSpaceObjectChild.
 *
 * @deprecated Use EveSpaceObjectChild.
 */
@be.interface("IEveSpaceObjectChild")
export class IEveSpaceObjectChild extends EveEntity
{
  static Origin = Origin;

}
