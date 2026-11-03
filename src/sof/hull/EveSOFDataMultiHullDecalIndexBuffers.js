import { exposure as be } from "#be";
import { IRoot } from "../../blue/blueexposure/IRoot.js";
// Source: trinity/trinity/Eve/SpaceObjectFactory/EveSOFData.h
// Maintained CarbonEngineJS implementation; generated schema is reference-only.
import { type, blue } from "#schema";

/** Combines a geometry resource path with the decal index buffers used by a multi-hull decal. */
@be.define({
  name: "EveSOFDataMultiHullDecalIndexBuffers",
  inherit: [ IRoot ],
  // EveSOFData_Blue.cpp:1018-1021, in Carbon's order.
  members: [
    [ be.ATTR, "combinedGeometryResPath", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "indexBuffers", be.READ | be.PERSIST ]
  ]
})
export class EveSOFDataMultiHullDecalIndexBuffers extends IRoot
{

  /** m_indexBuffers (PEveSOFDataDecalIndexBufferVector) [READ, PERSIST] */

  @type.list("EveSOFDataDecalIndexBuffer")
  indexBuffers = [];

  /** m_combinedGeometryResPath (std::string) [READWRITE, PERSIST] */

  @type.path("TriGeometryRes")
  combinedGeometryResPath = "";

}
