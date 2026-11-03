import { exposure as be } from "#be";
import { IRoot } from "../../blue/blueexposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type } from "#schema";

/** Stores named faction hull-area parameters and provides case-insensitive lookup. */
@be.define({
  name: "EveSOFDataFactionHullArea",
  inherit: [ IRoot ],
  // EveSOFData_Blue2.cpp:43-47, in Carbon's order.
  members: [
    [ be.ATTR, "name", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "parameters", be.READ | be.PERSIST ]
  ]
})

export class EveSOFDataFactionHullArea extends IRoot
{

  /** m_parameters (PEveSOFDataParameterVector) [READ, PERSIST] */

  @type.list("EveSOFDataParameter")
  parameters = [];

  /** m_name (BlueSharedString) [READWRITE, PERSIST] */

  @type.string
  name = "";

  /**
   * Performs a case-insensitive search for a nonempty parameter name and returns
   * the matching record or null.
   */
  FindParameter(name)
  {
    const normalized = String(name ?? "").toUpperCase();
    if (!normalized) return null;
    return this.parameters.find(value =>
      String(value?.name ?? "").toUpperCase() === normalized
    ) ?? null;
  }

}
