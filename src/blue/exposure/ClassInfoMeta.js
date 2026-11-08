// Ours: what the readers ask about a class beyond Carbon's ClassInfo: its
// persisted members as PersistedMember records, and the interfaces they test
// for with BlueCastPtr in Carbon. Built on first use from the class's ClassInfo
// rows (Blue plan step 6 compiles it at registration).
import { CjsSchema } from "#schema";
import { EDITFLAGS } from "../../global/consts/blue.js";
import { mappedInterfaces } from "../compose/interface.js";
import { PersistedMember } from "./PersistedMember.js";

/**
 * Ours: the persisted members of a class by name, and the interfaces the
 * readers ask about. Built on first use from the class's ClassInfo rows,
 * walking them as Carbon's `IRootReaderBase::FindEntry` does (IRootReader.cpp:303-319):
 * the class's table, then each parent's, a row with PERSIST, first name wins.
 * A row its class hides with `hideInherited` is left out, as `BlueRttiType` does.
 */
export class ClassInfoMeta
{
  /** Ours: the registered name, which minification cannot change. */
  static className = "ClassInfoMeta";

  /**
   * The persisted members by name.
   *
   * @type {Map<string, PersistedMember>}
   */
  entries = new Map();

  /** Whether the class maps IInitialize. @type {boolean} */
  isInitialize = false;

  /** Whether the class maps INotify. @type {boolean} */
  isNotify = false;

  /** Whether the class is an IBlueObjectProxy. @type {boolean} */
  isProxy = false;

  /** Whether the class maps ICustomPersist. @type {boolean} */
  isCustomPersist = false;

  /**
   * @param {import("./ClassInfo.js").ClassInfo} ci The class information.
   * @param {Function} Constructor The class.
   */
  constructor(ci, Constructor)
  {
    for (let type = ci; type; type = type.parentClassInfo)
    {
      for (const row of type.memberTable)
      {
        if (this.entries.has(row.name)) continue;
        if (type !== ci && ci.hiddenInherited.has(row.meta.key)) continue;
        const declaration = type.declarationOf(row);
        // Carbon's PERSIST, or ours: a member Carbon exposes READ that the values
        // service persists (EveChildContainer.origin) is read here too.
        if (!(row.editFlags & EDITFLAGS.PERSIST) && declaration.edit?.persist !== true && declaration.edit?.persistOnly !== true) continue;
        this.entries.set(row.name, new PersistedMember(row, declaration.type, declaration.index ?? -1));
      }
    }
    const mapped = mappedInterfaces(Constructor);
    // By registered name: the interface classes extend IRoot, which imports ClassInfo.
    this.isInitialize = ClassInfoMeta._provides(mapped, Constructor, "IInitialize");
    this.isNotify = ClassInfoMeta._provides(mapped, Constructor, "INotify");
    this.isProxy = ClassInfoMeta._provides(mapped, Constructor, "IBlueObjectProxy");
    this.isCustomPersist = ClassInfoMeta._provides(mapped, Constructor, "ICustomPersist");
  }

  /**
   * Asks whether a class provides an interface, mapped or inherited.
   *
   * @param {Set<Function>} mapped The class's mapped interfaces.
   * @param {Function} Constructor The class.
   * @param {string} Interface The interface's registered name.
   * @returns {boolean} True when it provides it.
   */
  static _provides(mapped, Constructor, Interface)
  {
    for (const each of mapped) if (CjsSchema.getClassName(each) === Interface) return true;
    for (let type = Constructor; type && type !== Function.prototype; type = Object.getPrototypeOf(type))
    {
      if (CjsSchema.getClassName(type) === Interface) return true;
    }
    return false;
  }
}
