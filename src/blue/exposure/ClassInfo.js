// Source: blueexposure/include/BlueTypes.h:378-400 (Be::ClassInfo)
// Source: blueexposure/include/BlueExposureMacrosPython.h:20-67 (ExposeToBlue, EXPOSURE_BEGIN_IMP, EXPOSURE_END_IMPL)
import { CjsSchema } from "#schema";
import { getCarbonTypeDefinition } from "../schema/types/carbonTypes.js";
import { ownMappedInterfaces, exposureChainTo } from "../compose/interface.js";
import { VarEntry } from "./VarEntry.js";
import { EDITFLAGS } from "../../global/consts/blue.js";

/** Be::EDITFLAGS bits, keyed by the schema's edit flag names. */
const EDIT_FLAG_BITS = [
  [ "read", EDITFLAGS.READ ], [ "write", EDITFLAGS.WRITE ], [ "notify", EDITFLAGS.NOTIFY ], [ "hidden", EDITFLAGS.HIDDEN ],
  [ "persist", EDITFLAGS.PERSIST ], [ "rpersist", EDITFLAGS.RPERSIST ]
];

/**
 * The bits a member's values path honours: its edit flags, Carbon's row with any of ours merged
 * in, and a Carbon row's editor bits, or what the type adds. @meta.mapAttribute(meta.PERSIST) on a
 * Carbon READ row is PERSIST here.
 * @param {object} member Declared member.
 * @returns {number} Be::EDITFLAGS bits.
 */
export function getDeclaredEditFlags(member)
{
  let flags = EDITFLAGS.NONE;
  if (member.edit !== undefined)
  {
    for (const [ flag, bit ] of EDIT_FLAG_BITS) if (member.edit[flag] === true) flags |= bit;
  }

  if (member.exposure) return flags | (member.exposure.flags & EDITFLAGS.EDMASK);

  if (member.type?.flags === true) flags |= EDITFLAGS.FLAGS;
  if (member.enum) flags |= EDITFLAGS.ENUM;

  return flags;
}

/**
 * A member's `mEditFlags` as Carbon's table holds them: the bits its exposure macro wrote, or for
 * an older declaration what it declares.
 * @param {object} member Declared member.
 * @returns {number} Be::EDITFLAGS bits.
 */
export function getEditFlags(member)
{
  return member.exposure ? member.exposure.flags : getDeclaredEditFlags(member);
}

/** @type {WeakMap<Function, {schema: object, classInfo: ClassInfo}>} */
const s_classInfo = new WeakMap();

/**
 * A class's Blue type information: Carbon's `Be::ClassInfo`, which a class's
 * `ExposeToBlue()` builds once from its exposure macros and keeps
 * (`EXPOSURE_BEGIN_IMP`, BlueExposureMacrosPython.h:23-24). Here the macros
 * are the class's `be`/`meta` decorators, so `ClassInfo.exposeToBlue(Class)`
 * reads their metadata and builds the record once. The flattened lookup is
 * `BlueRttiType`, which `BlueClasses.GetRtti` builds from it on demand.
 *
 * This sits beside the schema's own class record (`CjsSchema.getSchema`) and
 * reads it; tests compare the two for every registered class
 * (decorator-upgrade.md § 5 step 2).
 *
 * Carbon: Be::ClassInfo (blueexposure/include/BlueTypes.h:378-400)
 *
 * @adapted built once from the class's decorator metadata, which stands in for Carbon's exposure macros.
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
   * `mParentClassInfo`: the parent's class info, or null.
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
   * `ExposeToBlue()` (BlueExposureMacrosPython.h:20-67): the class's
   * information, built on the first call and returned from then on.
   *
   * `parentClassInfo` follows `EXPOSURE_CHAINTO`, as Carbon's does, never `extends`.
   * The class's own rows are what it declares, and what unregistered helper
   * classes between it and its nearest registered JS ancestor declare.
   *
   * @adapted our decorators stand in for the macros. Carbon generates one
   *   `ExposeToBlue` per class from its macros; JavaScript has one static that
   *   takes the class and reads its decorator metadata.
   *   The record is rebuilt only when that metadata has changed since (the
   *   schema hands out a new record then), which happens while classes are
   *   still being declared and in tests.
   * @param {Function} Constructor A class with registered metadata.
   * @returns {ClassInfo} Its class information.
   */
  static exposeToBlue(Constructor)
  {
    const schema = CjsSchema.getSchema(Constructor);
    const cached = s_classInfo.get(Constructor);
    // A chain declared after a first lookup changes no schema, so the cache compares the chain too.
    if (cached && cached.schema === schema && cached.chained === exposureChainTo(Constructor)) return cached.classInfo;

    const ci = new ClassInfo();
    ci.classId = schema.className;
    ci.iid = schema.className;
    ci.blue = schema.blue === true;
    for (const Interface of ownMappedInterfaces(Constructor)) ci.interfaceTable.push(CjsSchema.getClassName(Interface));

    const Chained = exposureChainTo(Constructor);
    ci.parentClassInfo = Chained ? ClassInfo.exposeToBlue(Chained) : null;
    const Parent = ClassInfo._parentClass(Constructor);
    for (let parent = ci.parentClassInfo; parent; parent = parent.parentClassInfo)
    {
      for (const entry of parent.memberTable) if (CjsSchema.isFieldHidden(Constructor, entry.meta.key)) ci.hiddenInherited.add(entry.meta.key);
    }

    // The class's own rows: those declared on it or on a superclass between it and its parent that has no class info of its own.
    const own = new Set();
    for (let type = Constructor; type && type !== Parent; type = Object.getPrototypeOf(type)) own.add(type);
    const seen = new Set();
    // Carbon's member-table order where the class declares an exposure bag (CjsSchema.orderByExposureRows).
    const rows = CjsSchema.orderByExposureRows(Constructor, [ ...schema.members, ...schema.properties.filter(property => property.property || property.edit) ]);
    for (let i = 0; i < rows.length; i++)
    {
      const member = rows[i];
      if (!own.has(member.declaringClass)) continue;
      // An older declaration under a name a complete row already gave adds nothing (PyGetTypeInfo skips it too); two
      // complete rows under one name are both kept, as both are in Carbon's table.
      if (seen.has(member.name) && !member.exposure) continue;
      if (member.exposure) seen.add(member.name);
      ci.memberTable.push(ClassInfo._varEntryOf(Constructor, member));
    }

    // mPyMethodTable holds the class's methods and its parents' along the exposure chain, the walk PyGetTypeInfo makes
    // (BlueClasses._typeInfo). Only a method with an exposure record (a `map*` row) is in it.
    const methodNames = new Set();
    for (let type = Constructor; type; type = exposureChainTo(type))
    {
      for (const method of CjsSchema.getSchema(type).methods || [])
      {
        if (!method.exposure) continue;
        const blue = method.exposure.origin !== "ours";
        for (const name of [ method.exposure.name ?? method.name, ...(method.exposure.aliases ?? []).map(alias => alias.name ?? method.name) ])
        {
          if (methodNames.has(name)) continue;
          methodNames.add(name);
          ci.pyMethodTable.push({ name, key: method.name, blue });
        }
      }
    }

    s_classInfo.set(Constructor, { schema, chained: Chained, classInfo: ci });
    return ci;
  }

  /**
   * The nearest superclass with a registered name, where the class's own rows
   * end (see `exposeToBlue`). Ours.
   *
   * @cjs
   * @implemented
   * @param {Function} Constructor The class.
   * @returns {Function|null} The parent class, or null.
   */
  static _parentClass(Constructor)
  {
    for (let type = Object.getPrototypeOf(Constructor); type && type !== Function.prototype; type = Object.getPrototypeOf(type))
    {
      if (CjsSchema.getClassName(type)) return type;
    }
    return null;
  }

  /**
   * One member or property row as a `VarEntry`. The flags are the row's own
   * when it carries an exposure record; an older declaration without one has
   * its editor bits derived from its edit flags, `type.flags` and enum, as
   * PyGetTypeInfo reports them (BlueClasses._typeInfo). Ours: Carbon's
   * macros write each `VarEntry` directly.
   *
   * @cjs
   * @implemented
   * @param {Function} Constructor The class, for the property's accessors.
   * @param {object} member The schema's member or property record.
   * @returns {VarEntry} The row.
   */
  static _varEntryOf(Constructor, member)
  {
    const entry = new VarEntry();
    const type = member.type;
    const reference = type && (type.kind === "rootRef" || type.kind === "rootWeak") ? type.className : null;
    entry.name = member.name;
    entry.meta.key = member.key ?? member.name;
    entry.type = getCarbonTypeDefinition(type).kind;
    entry.iid = typeof reference === "function" ? CjsSchema.getClassName(reference) : reference || null;
    entry.description = member.jessica && member.jessica.description ? member.jessica.description : "";
    // An older declaration without an exposure record is in Blue's view, as PyGetTypeInfo lists it today.
    entry.meta.blue = !member.exposure || member.exposure.origin !== "ours";
    entry.editFlags = getEditFlags(member);
    const chooser = member.exposure
      ? member.exposure.chooser ? member.chooser.entries : null
      : member.chooser ? member.chooser.entries : member.enum && member.enum.chooser;
    entry.chooserTable = chooser ? chooser.map(item => [ item.name, item.value, item.description || "" ]) : null;
    if (member.role === "property" || member.property)
    {
      const descriptor = ClassInfo._findDescriptor(Constructor.prototype, entry.meta.key);
      entry.getProperty = descriptor?.get ?? null;
      entry.setProperty = descriptor?.set ?? null;
    }
    return entry;
  }

  /**
   * The accessor descriptor for a key, wherever it is on the prototype chain.
   * Ours: Carbon's macros take the getter and setter as arguments.
   *
   * @cjs
   * @implemented
   * @param {object} prototype The class prototype.
   * @param {string} key The property key.
   * @returns {PropertyDescriptor|null} The descriptor, or null.
   */
  static _findDescriptor(prototype, key)
  {
    for (let target = prototype; target; target = Object.getPrototypeOf(target))
    {
      const descriptor = Object.getOwnPropertyDescriptor(target, key);
      if (descriptor) return descriptor;
    }
    return null;
  }

  /**
   * Ours: the registered name, which minification cannot change.
   *
   * @cjs
   * @implemented
   */
  static className = "ClassInfo";

}

