import { exposure as be } from "#be";
import { IRoot } from "../../blue/exposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type } from "#schema";
import { BlueList } from "#blue";
import { EveSOFDataHullBoosterItem } from "./EveSOFDataHullBoosterItem.js";

/** Groups booster placements and records whether boosters and their trails remain active. */
@be.define("EveSOFDataHullBooster")
@be.inherit(IRoot)
export class EveSOFDataHullBooster extends IRoot
{

  /** m_items (PEveSOFDataHullBoosterItemVector) [READ, PERSIST] */
  @be.mapAttribute(be.READ | be.PERSIST)

  @type.list("EveSOFDataHullBoosterItem")
  items = new BlueList(EveSOFDataHullBoosterItem, { className: "EveSOFDataHullBoosterItem" });

  /** m_alwaysOn (bool) [READWRITE, PERSIST] */
  @be.mapAttribute(be.READWRITE | be.PERSIST)

  @type.boolean
  alwaysOn = false;

  /** m_hasTrails (bool) [READWRITE, PERSIST] */
  @be.mapAttribute(be.READWRITE | be.PERSIST)

  @type.boolean
  hasTrails = true;

}
