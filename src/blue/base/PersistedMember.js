// Ours: one persisted member as the readers read it. Carbon's Be::VarEntry
// carries the member's type and offset, and the C++ type gives the rest; a
// JavaScript member is a property, so the key, the element index, the container
// kind and the structure layout are recorded here, beside the Carbon row. The
// schema's compile fills it (compileClassInfo); names it cannot resolve yet
// resolve on first read, through the resolvers the compile supplies.
import { EDITFLAGS } from "../../global/consts/blue.js";

/**
 * What an IROOT member is. Carbon casts the destination to find out; a plain
 * record, and plain JavaScript storage, cannot be cast.
 *
 * @enum {number}
 */
export const BLACK_DESTINATION = Object.freeze({
  OBJECT: 0,
  LIST: 1,
  ARRAY: 2,
  SET: 3,
  DICT: 4,
  STRUCTURELIST: 5,
  WRAPPER: 6
});

/**
 * One persisted member as the readers read it: its Carbon row, and ours.
 * Carbon's facts are read from the row; the rest is recorded here.
 */
export class PersistedMember
{
  /** Ours: the registered name, which minification cannot change. */
  static className = "PersistedMember";

  /** What an IROOT member is (see `BLACK_DESTINATION`). */
  static BLACK_DESTINATION = BLACK_DESTINATION;

  /**
   * The compile's class lookup by registered name, or null before the schema loads.
   *
   * @type {((name: string) => Function|null)|null}
   */
  static classResolver = null;

  /**
   * The compile's structure-list layout for an item class, or null before the schema loads.
   *
   * @type {((item: string|Function) => object)|null}
   */
  static structureResolver = null;

  /**
   * The Carbon row: name, `mType`, `mEditFlags`, accessors.
   *
   * @type {import("./VarEntry.js").VarEntry|null}
   */
  var = null;

  /**
   * The JavaScript key that stands in for `mOffset`.
   *
   * @type {string}
   */
  key = "";

  /**
   * An element of the array at `key`, or -1.
   *
   * @type {number}
   */
  index = -1;

  /**
   * The sign of a BYTE or SHORT, which Carbon's member type gives.
   *
   * @type {boolean}
   */
  signed = false;

  /**
   * Carbon's `GetFloatArraySize`.
   *
   * @type {number}
   */
  floatArraySize = 0;

  /**
   * What an IROOT member is (`BLACK_DESTINATION`).
   *
   * @type {number}
   */
  destination = BLACK_DESTINATION.OBJECT;

  /**
   * Whether a list of this kind keeps null items: a plain array does.
   *
   * @type {boolean}
   */
  keepsNulls = false;

  /**
   * A math member's wire class, or null.
   *
   * @type {string|null}
   */
  wrapperClass = null;

  /**
   * A math member's declared kind (mat4, vec3, ...), which its wire class must hold, or null.
   *
   * @type {string|null}
   */
  wrapperKind = null;

  /**
   * The accepted classes as declared, by class or registered name (Carbon's `mIID`, as a list).
   *
   * @type {Array<string|Function>}
   */
  accepts = [];

  /**
   * The structure list's item class, or null.
   *
   * @type {string|Function|null}
   */
  structClass = null;

  /**
   * The accepted classes once every name has resolved; null until then.
   *
   * @type {Function[]|null}
   */
  _iids = null;

  /**
   * A structure list's layout, compiled on first read.
   *
   * @type {object|null|undefined}
   */
  _structure = undefined;

  /** `mName`. */
  get name() { return this.var.name; }

  /** `mType`, a VARTYPE. */
  get type() { return this.var.type; }

  /** Whether `mEditFlags` has NOTIFY. */
  get notify() { return (this.var.editFlags & EDITFLAGS.NOTIFY) !== 0; }

  /** Whether a setter takes the value. */
  get isProperty() { return this.var.getProperty !== null || this.var.setProperty !== null; }

  /**
   * The accepted classes that are registered; empty means any object. Kept once
   * every declared name has resolved, so a class registered later still counts.
   *
   * @returns {Function[]} The classes.
   */
  get iids()
  {
    if (this._iids !== null) return this._iids;
    const found = [];
    let complete = true;
    for (const accepted of this.accepts)
    {
      const Class = typeof accepted === "function" ? accepted : PersistedMember.classResolver(accepted);
      if (Class) found.push(Class);
      else complete = false;
    }
    if (complete) this._iids = found;
    return found;
  }

  /**
   * A structure list's layout: the item class's `meta.struct` record, each
   * field as an entry the handlers read as a member, or null.
   *
   * @returns {{size: number, boundaries: number[], Item: Function, fields: object[], definition: object}|null} The layout.
   * @throws {TypeError} When the item class is unregistered or declares no structure.
   */
  get structure()
  {
    if (this._structure !== undefined) return this._structure;
    this._structure = this.structClass ? PersistedMember.structureResolver(this.structClass) : null;
    return this._structure;
  }
}
