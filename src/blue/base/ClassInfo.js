// Source: blueexposure/include/BlueTypes.h:378-400 (Be::ClassInfo)
// Source: blueexposure/include/BlueExposureMacrosPython.h:20-67 (ExposeToBlue, EXPOSURE_BEGIN_IMP, EXPOSURE_END_IMPL)
//
// A passive record: it imports nothing but global/consts. The schema compiles
// each class into one at registration (blue/schema/compileClassInfo.js) and
// stores it here; the registration carries the same object.

/**
 * A class's Blue type information: Carbon's `Be::ClassInfo`, which a class's
 * `ExposeToBlue()` builds once from its exposure macros and keeps
 * (`EXPOSURE_BEGIN_IMP`, BlueExposureMacrosPython.h:23-24). Here the macros
 * are the class's `be`/`meta` decorators, and the schema compiles them once,
 * when the class registers. The flattened lookup is `BlueRttiType`, which
 * `BlueClasses.GetRtti` builds from it on demand.
 *
 * Carbon: Be::ClassInfo (blueexposure/include/BlueTypes.h:378-400)
 *
 * @adapted compiled once at registration from the class's decorator metadata, which stands in for Carbon's exposure macros.
 */
export class ClassInfo
{

  /**
   * `mClassId`: the registered class name (a class id is its name, see BlueClasses).
   *
   * @implemented
   */
  classId = "";

  /**
   * `mIID`: the class's own interface id, its registered name.
   *
   * @implemented
   */
  iid = "";

  /**
   * `mDescription`: Carbon's doc string. Ours live in JSDoc.
   *
   * @implemented
   */
  description = "";

  /**
   * `mInterfaceTable`: the class's own `MAP_INTERFACE` entries, in order.
   *
   * @implemented
   */
  interfaceTable = [];

  /**
   * `mMemberTable`: the class's own rows.
   *
   * @implemented
   */
  memberTable = [];

  /**
   * `mPyMethodTable`: `{ name, key, blue }` for every exposed method, the class's and its parents'.
   *
   * @implemented
   */
  pyMethodTable = [];

  /**
   * `mParentClassInfo`: the parent's class info along `EXPOSURE_CHAINTO`, or null.
   *
   * @implemented
   */
  parentClassInfo = null;

  /**
   * `mRtti`: built by `BlueClasses.GetRtti` on first request.
   *
   * @implemented
   */
  rtti = null;

  /**
   * Ours: whether the class is Carbon's exposure (`be.define`) rather than ours (`meta.define`).
   *
   * @cjs
   * @implemented
   */
  blue = false;

  /**
   * Ours: the keys of parent rows this class hides (`hideInherited`), which its RTTI leaves out. Carbon has no way to
   * hide an inherited member; our classes declare it where a subclass drops a base's member.
   * @cjs
   * @implemented
   */
  hiddenInherited = new Set();

  /**
   * Ours: the class this information describes. Carbon's `ClassInfo` is the
   * class's own static; here it is compiled from the class.
   *
   * @cjs
   * @type {Function|null}
   */
  _type = null;

  /**
   * Ours: each own row's declaration, for the record `meta` builds.
   *
   * @cjs
   * @type {Map<import("./VarEntry.js").VarEntry, object>}
   */
  _declarations = new Map();

  /**
   * Ours, built on first use and cleared when the class or a parent recompiles:
   * the persisted members as the readers read them, and the interfaces they ask
   * about. Carbon's readers take the same from the C++ member types and `BlueCastPtr`.
   *
   * @cjs
   * @type {import("./ClassInfoMeta.js").ClassInfoMeta|null}
   */
  _meta = null;

  /**
   * Ours: the readers' record of this class (`ClassInfoMeta`), from the compile's builder.
   *
   * @cjs
   * @returns {import("./ClassInfoMeta.js").ClassInfoMeta} The record.
   */
  get meta()
  {
    if (this._meta === null) this._meta = ClassInfo.metaBuilder(this);
    return this._meta;
  }

  /**
   * Ours: the declaration an own row was compiled from.
   *
   * @cjs
   * @param {import("./VarEntry.js").VarEntry} row A row of `memberTable`.
   * @returns {object} The schema's member or property record.
   */
  declarationOf(row)
  {
    return this._declarations.get(row);
  }

  /**
   * Ours: compiled records by class. The registration carries the same object.
   *
   * @cjs
   * @type {WeakMap<Function, ClassInfo>}
   */
  static _byType = new WeakMap();

  /**
   * Ours: the schema's compile, for a class asked about before or without
   * registering (it stores what it compiles). Null until the schema loads.
   *
   * @cjs
   * @type {((Constructor: Function) => ClassInfo)|null}
   */
  static compiler = null;

  /**
   * Ours: the schema's builder for `meta`. Null until the schema loads.
   *
   * @cjs
   * @type {((ci: ClassInfo) => import("./ClassInfoMeta.js").ClassInfoMeta)|null}
   */
  static metaBuilder = null;

  /**
   * `ExposeToBlue()` (BlueExposureMacrosPython.h:20-67): the class's
   * information. The compile at registration stored it; a class not yet
   * compiled is compiled now.
   *
   * @adapted one static takes the class, where Carbon generates one `ExposeToBlue` per class from its macros.
   * @param {Function} Constructor A class.
   * @returns {ClassInfo} Its class information.
   */
  static exposeToBlue(Constructor)
  {
    return ClassInfo._byType.get(Constructor) ?? ClassInfo.compiler(Constructor);
  }

  /**
   * Ours: records a class's compiled information. The compile calls this.
   *
   * @cjs
   * @param {Function} Constructor The class.
   * @param {ClassInfo} ci Its information.
   */
  static store(Constructor, ci)
  {
    ClassInfo._byType.set(Constructor, ci);
  }

  /**
   * Ours: the registered name, which minification cannot change.
   *
   * @cjs
   * @implemented
   */
  static className = "ClassInfo";

}
