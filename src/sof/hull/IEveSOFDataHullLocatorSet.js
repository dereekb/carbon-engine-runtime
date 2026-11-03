import { exposure as be } from "#be";
import { IRoot } from "../../blue/blueexposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h

/** Empty Carbon marker interface for hull locator-set list members (EveSOFData.h:1107-1111). */
@be.interface("IEveSOFDataHullLocatorSet")
@be.inherit(IRoot)
export class IEveSOFDataHullLocatorSet extends IRoot
{

}
