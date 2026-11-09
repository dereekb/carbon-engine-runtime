// Reads Black bytes the way the runtime does: Carbon's BlackReader, building the
// registered Blue classes the file names. Tests that read a file into objects use
// this rather than repeating the reader's caching and error handling.
import { BlackReader } from "../../npm/dist/blue/formats/black/BlackReader.js";
// BlackReader asks Blue's class registry (BeClasses) for each class, which BlueClasses sets up.
import "../../npm/dist/blue/exposure/BlueClasses.js";

/**
 * A caching BlackReader over one file, as ResMan keeps one per file.
 *
 * @param {ArrayBuffer|ArrayBufferView} bytes The file.
 * @param {{initialize?: boolean}} [options] `initialize: false` skips Initialize on the objects built.
 * @returns {BlackReader} The reader; `CreateObject(0)` builds a new graph each call.
 * @throws {Error} When the bytes are not a Black file BlackReader reads.
 */
export function blackBuilder(bytes, { initialize = true } = {})
{
  const reader = new BlackReader();
  reader.SetDoInitialize(initialize);
  const view = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  if (!reader.ReadForCachingFromStream(view)) throw new Error(reader.GetErrorMessage() || "not a Black file");
  return reader;
}

/**
 * The file's root object.
 *
 * @param {ArrayBuffer|ArrayBufferView} bytes The file.
 * @param {{initialize?: boolean}} [options] As `blackBuilder`.
 * @returns {object} The root object.
 * @throws {Error} With BlackReader's message when the read fails.
 */
export function readBlack(bytes, options = {})
{
  const reader = blackBuilder(bytes, options);
  const root = reader.CreateObject(0);
  if (root === null) throw new Error(reader.GetErrorMessage() || "Black root object is null");
  return root;
}
