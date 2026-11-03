import { exposure as be } from "#be";
import { IRoot } from "../../blue/exposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h

/** Empty Carbon marker interface for hull-extension placement list members (EveSOFData.h:1911-1915). */
@be.interface("IEveSOFDataHullExtensionPlacement")
@be.inherit(IRoot)
export class IEveSOFDataHullExtensionPlacement extends IRoot
{

}
