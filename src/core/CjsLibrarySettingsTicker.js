import { CjsSchema } from "#schema";
import { IBlueEvents } from "../blue/interfaces/IBlueEvents.js";

/**
 * Ours: runs CjsLibrary's settings policy on each Blue tick (forced settings,
 * and starting or stopping attached audio to follow `audioEnabled`). Carbon
 * has no counterpart; its settings are plain globals read where used.
 */
export class CjsLibrarySettingsTicker extends IBlueEvents
{
  /** The library whose policy runs. */
  _library = null;

  /** @param {object} library The CjsLibrary to tick. */
  constructor(library)
  {
    super();
    this._library = library;
  }

  /** Blue tick: applies the library's settings policy. */
  OnTick(_realTime, _simTime, _cookie)
  {
    this._library._ApplySettingsPolicy(false);
  }
}

CjsSchema.meta.define("CjsLibrarySettingsTicker")(CjsLibrarySettingsTicker);
CjsSchema.meta.exposureChainTo(IBlueEvents)(CjsLibrarySettingsTicker);
