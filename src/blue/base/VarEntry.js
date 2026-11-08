// Source: blueexposure/include/BlueTypes.h:321-375 (Be::VarEntry)
import { VARTYPE } from "../../global/consts/blue.js";

/**
 * One row of a class's member table: Carbon's `Be::VarEntry`, which
 * `MAP_ATTRIBUTE` and `MAP_PROPERTY*` push into the table `EXPOSURE_BEGIN`
 * starts (BlueExposureMacrosPython.h:35). Filled once per class by the
 * schema's compile at registration (`compileClassInfo`).
 *
 * Adapted: Carbon's `mOffset` and `mSize` locate the member's bytes in the
 * object; a JavaScript member is located by its property key, so `meta.key` stands
 * in for both. Carbon's table holds only Blue rows; ours also holds the rows
 * our own classes declare with `meta.map*`, and `meta.blue` says which a row is
 * (`be` is `meta` plus Blue, decorator-upgrade.md § 6.8).
 *
 * Carbon: Be::VarEntry (blueexposure/include/BlueTypes.h:321-375)
 *
 * @adapted `meta.key` stands in for `mOffset` and `mSize`, and the table also carries our own `meta.map*` rows, flagged by `meta.blue`.
 */
export class VarEntry
{

  /**
   * `mName`: the exposed name.
   *
   * @implemented
   */
  name = "";

  /**
   * `mType`: the member's VARTYPE, from its declared type; INVALID for a type with none.
   *
   * @implemented
   */
  type = VARTYPE.INVALID;

  /**
   * JavaScript-specific member metadata. `key` locates the value instead of
   * a native byte offset; `blue` marks rows exposed to Blue rather than
   * only our own metadata consumers. Each entry owns its metadata object.
   *
   * @cjs
   * @implemented
   */
  meta = { key: "", blue: false };

  /**
   * `mIID`: the interface or class a reference member holds, by registered name, or null.
   *
   * @implemented
   */
  iid = null;

  /**
   * `mDescription`: Carbon's doc string. Ours live in JSDoc, so it is empty unless an editor annotation gives one.
   *
   * @implemented
   */
  description = "";

  /**
   * `mEditFlags`: `Be::EDITFLAGS` bits.
   *
   * @implemented
   */
  editFlags = 0;

  /**
   * `mChooserTable`: `[name, value, description]` rows, or null. A chooser that
   * names its enum is resolved on first read: the enum may register after the class.
   *
   * @implemented
   * @returns {Array<Array<*>>|null} The rows.
   */
  get chooserTable()
  {
    if (this._chooserSource !== null)
    {
      const { entries, enumType, required } = this._chooserSource;
      const resolved = entries ?? (enumType === null ? null : VarEntry.chooserResolver(enumType, required));
      this._chooserTable = resolved ? resolved.map(item => [ item.name, item.value, item.description || "" ]) : null;
      this._chooserSource = null;
    }
    return this._chooserTable;
  }

  set chooserTable(rows)
  {
    this._chooserTable = rows;
    this._chooserSource = null;
  }

  /**
   * Ours: the rows, once resolved.
   *
   * @cjs
   * @type {Array<Array<*>>|null}
   */
  _chooserTable = null;

  /**
   * Ours: where the rows come from until first read: given entries, or an enum by name.
   *
   * @cjs
   * @type {{entries: (object[]|null), enumType: (string|null), required: boolean}|null}
   */
  _chooserSource = null;

  /**
   * Ours: records where `chooserTable` comes from, resolved on its first read.
   *
   * @cjs
   * @param {object[]|null} entries The chooser's `{ name, value, description }` entries, when declared inline.
   * @param {string|null} enumType Otherwise the registered enum that supplies them.
   * @param {boolean} required Whether that enum must register a chooser.
   */
  setChooserSource(entries, enumType, required)
  {
    this._chooserSource = { entries, enumType, required };
  }

  /**
   * Ours: the schema's lookup of an enum's chooser entries by name. Null until the schema loads.
   *
   * @cjs
   * @type {((enumType: string, required: boolean) => (object[]|null))|null}
   */
  static chooserResolver = null;

  /**
   * `mGetProperty`: the property's getter, or null for an attribute.
   *
   * @implemented
   */
  getProperty = null;

  /**
   * `mSetProperty`: the property's setter, or null for an attribute or a read-only property.
   *
   * @implemented
   */
  setProperty = null;

  /**
   * Ours: the registered name, which minification cannot change.
   *
   * @cjs
   * @implemented
   */
  static className = "VarEntry";

}
