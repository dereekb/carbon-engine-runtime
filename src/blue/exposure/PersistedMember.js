// Ours: one persisted member as the readers read it. Carbon's Be::VarEntry
// carries the member's type and offset, and the C++ type gives the rest; a
// JavaScript member is a property, so the key, the element index, the container
// kind and the structure layout are recorded here, beside the Carbon row
// (Blue plan step 6 compiles them at registration).
import { CjsSchema } from "#schema";
import { VARTYPE } from "../../global/model/graph/graphTypes.js";
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

/** A declared scalar kind's VARTYPE, sign and float count (Carbon reads them from the C++ member type). */
const SCALARS = Object.freeze({
  boolean: [ VARTYPE.BOOL, false, 0 ],
  string: [ VARTYPE.STDSTRING, false, 0 ],
  path: [ VARTYPE.STDSTRING, false, 0 ],
  expression: [ VARTYPE.STDSTRING, false, 0 ],
  wstring: [ VARTYPE.STDWSTRING, false, 0 ],
  wpath: [ VARTYPE.STDWSTRING, false, 0 ],
  enum: [ VARTYPE.LONG, true, 0 ],
  float32: [ VARTYPE.FLOAT, false, 0 ],
  float64: [ VARTYPE.DOUBLE, false, 0 ],
  int8: [ VARTYPE.BYTE, true, 0 ],
  uint8: [ VARTYPE.BYTE, false, 0 ],
  int16: [ VARTYPE.SHORT, true, 0 ],
  uint16: [ VARTYPE.SHORT, false, 0 ],
  int32: [ VARTYPE.LONG, true, 0 ],
  uint32: [ VARTYPE.ULONG, false, 0 ],
  int64: [ VARTYPE.INT64, true, 0 ],
  uint64: [ VARTYPE.UINT64, false, 0 ],
  vec2: [ VARTYPE.FLOATARRAY, false, 2 ],
  vector2: [ VARTYPE.FLOATARRAY, false, 2 ],
  vec3: [ VARTYPE.FLOATARRAY, false, 3 ],
  vector3: [ VARTYPE.FLOATARRAY, false, 3 ],
  vec4: [ VARTYPE.FLOATARRAY, false, 4 ],
  vector4: [ VARTYPE.FLOATARRAY, false, 4 ],
  color: [ VARTYPE.FLOATARRAY, false, 4 ],
  quat: [ VARTYPE.FLOATARRAY, false, 4 ],
  quaternion: [ VARTYPE.FLOATARRAY, false, 4 ],
  mat3: [ VARTYPE.FLOATARRAY, false, 9 ],
  matrix3: [ VARTYPE.FLOATARRAY, false, 9 ],
  mat4: [ VARTYPE.FLOATARRAY, false, 16 ],
  matrix4: [ VARTYPE.FLOATARRAY, false, 16 ]
});

/** A declared container kind's destination. */
const CONTAINERS = Object.freeze({
  list: BLACK_DESTINATION.LIST,
  array: BLACK_DESTINATION.ARRAY,
  set: BLACK_DESTINATION.SET,
  map: BLACK_DESTINATION.DICT
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
   * What an IROOT member is (`PersistedMember.BLACK_DESTINATION`).
   *
   * @type {number}
   */
  destination = 0;

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
   * The accepted classes, registered ones only; empty means any object (Carbon's `mIID`, as a list).
   *
   * @type {Function[]}
   */
  iids = [];

  /**
   * The structure list's item class, or null.
   *
   * @type {string|Function|null}
   */
  _structClass = null;

  /**
   * A structure list's layout, compiled on first read.
   *
   * @type {object|null|undefined}
   */
  _structure = undefined;

  /**
   * @param {import("./VarEntry.js").VarEntry} varEntry The Carbon row.
   * @param {object} declared The member's declared type.
   * @param {number} index An element of the array at the key, or -1.
   */
  constructor(varEntry, declared, index)
  {
    const member = PersistedMember.declaredMemberType(declared);
    this.var = varEntry;
    this.key = varEntry.meta.key;
    this.index = index;
    this.signed = member.signed;
    this.floatArraySize = member.floatArraySize;
    this.destination = member.destination;
    this.keepsNulls = declared?.kind === "array";
    this.wrapperClass = member.wrapperClass;
    this.wrapperKind = member.wrapperClass ? declared.kind : null;
    this.iids = [];
    for (const accepted of member.type === VARTYPE.INVALID ? [] : declared?.accepts ?? (declared?.className ? [ declared.className ] : []))
    {
      const Class = typeof accepted === "function" ? accepted : CjsSchema.getConstructor(accepted);
      if (Class) this.iids.push(Class);
    }
    this._structClass = member.structClass;
    this._structure = undefined;
  }

  /**
   * A declared type as Carbon's member type gives it: VARTYPE, sign, float count,
   * and for an IROOT member what it holds. Moved from the Black reader's schema
   * registry (`CjsBlackSchemaRegistry.fromDeclaredType`) so Blue answers it. A
   * type with no VARTYPE gives INVALID, so reading it gives Carbon's "Invalid
   * attribute type".
   *
   * @param {object|string|Function|undefined} declared The member's declared type.
   * @returns {{type: number, signed: boolean, floatArraySize: number, destination: number, wrapperClass: (string|null), structClass: (string|Function|null)}} The member type.
   */
  static declaredMemberType(declared)
  {
    let type = declared;
    if (typeof type === "function") type = { kind: "rootRef", className: type };
    if (typeof type === "string") type = { kind: type };
    const result = { type: VARTYPE.INVALID, signed: false, floatArraySize: 0, destination: BLACK_DESTINATION.OBJECT, wrapperClass: null, structClass: null };
    if (!type || type.runtimeOnly === true) return result;

    // type.binary is Carbon's BINARYBLOCK, whatever value the member holds.
    if (type.binary === true)
    {
      result.type = VARTYPE.BINARYBLOCK;
      return result;
    }
    // type.mat4.wrapped("TriMatrix") etc.: an embedded Blue math wrapper read into the declared value.
    if (type.wrapped)
    {
      result.type = VARTYPE.IROOT;
      result.destination = BLACK_DESTINATION.WRAPPER;
      result.wrapperClass = type.wrapped;
      return result;
    }

    const kind = type.kind;
    if (Object.hasOwn(SCALARS, kind))
    {
      [ result.type, result.signed, result.floatArraySize ] = SCALARS[kind];
      return result;
    }
    if (kind === "rootRef") result.type = VARTYPE.IROOTPTR;
    else if (kind === "rootWeak") result.type = VARTYPE.IROOTWEAKREF;
    else if (kind === "root") result.type = VARTYPE.IROOT;
    else if (kind === "structList")
    {
      result.type = VARTYPE.IROOT;
      result.destination = BLACK_DESTINATION.STRUCTURELIST;
      result.structClass = type.className;
    }
    else if (Object.hasOwn(CONTAINERS, kind))
    {
      // A list, array, set or dict holds object references only.
      let itemType = kind === "map" ? type.valueType : type.itemType;
      if (typeof itemType === "string" || typeof itemType === "function") itemType = { kind: "rootRef" };
      if (itemType?.kind === "rootRef" || itemType?.kind === "rootWeak")
      {
        result.type = VARTYPE.IROOT;
        result.destination = CONTAINERS[kind];
      }
    }
    return result;
  }

  /** `mName`. */
  get name() { return this.var.name; }

  /** `mType`, a VARTYPE. */
  get type() { return this.var.type; }

  /** Whether `mEditFlags` has NOTIFY. */
  get notify() { return (this.var.editFlags & EDITFLAGS.NOTIFY) !== 0; }

  /** Whether a setter takes the value. */
  get isProperty() { return this.var.getProperty !== null || this.var.setProperty !== null; }

  /**
   * A structure list's layout: the item class's `meta.struct` record, each
   * field as an entry the handlers read as a member, or null.
   *
   * @returns {{size: number, boundaries: number[], Item: Function, fields: object[], definition: object}|null} The layout, and the item class's own `BlueStructureDefinition`.
   * @throws {TypeError} When the item class is unregistered or declares no structure.
   */
  get structure()
  {
    if (this._structure !== undefined) return this._structure;
    if (!this._structClass) return (this._structure = null);
    const Item = typeof this._structClass === "function" ? this._structClass : CjsSchema.getConstructor(this._structClass);
    if (!Item) throw new TypeError(`Black struct item class ${this._structClass} is not registered (import its package)`);
    const definition = CjsSchema.getSchema(Item).structureDefinition;
    if (!definition) throw new TypeError(`Black struct ${CjsSchema.getClassName(Item)} has no structureDefinition`);
    const declarations = new Map();
    for (const member of CjsSchema.getSchema(Item).members)
    {
      if (member.role === "member" && !declarations.has(member.name)) declarations.set(member.name, member);
    }
    const fields = definition.members.map(field =>
    {
      const declaration = declarations.get(field.name);
      const type = PersistedMember.declaredMemberType({ kind: field.type });
      return {
        name: field.name, key: declaration.key, index: declaration.index ?? -1, type: type.type, notify: false, isProperty: false,
        signed: type.signed, floatArraySize: type.floatArraySize, iids: [], destination: type.destination, keepsNulls: false,
        wrapperClass: null, wrapperKind: null, structure: null, offset: field.offset
      };
    });
    return (this._structure = { size: definition.size, boundaries: definition.boundaries ?? [], Item, fields, definition });
  }
}
