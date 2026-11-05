import { CjsGraphClassInfo } from "./CjsGraphClassInfo.js";

/**
 * Independent graph declarations and their compiled class records.
 * @cjs Registration foundation only; value operations and traversal follow separately.
 */
export class CjsGraph
{

  /** One record per registered constructor. */
  static _classes = new Map();

  /** Stable declared names, never inferred from Function.name. */
  static _names = new Map();

  /** Invalidates derived descriptions after registration changes, including late parents. */
  static _revision = 0;

  /**
   * Registers or replaces a class's own definition while retaining its class-info identity.
   * Definition shape: { name, members: [{ name, key?, handler, options?, ...metadata }] }.
   * @cjs Snapshots declaration containers; handlers and authored default values are not cloned.
   */
  static define(ctor, definition)
  {
    if (typeof ctor !== "function") throw new TypeError("Graph class requires a constructor.");
    const name = definition.name;
    if (typeof name !== "string" || !name) throw new TypeError("Graph class requires a stable name.");
    const existing = this._classes.get(ctor);
    const named = this._names.get(name);
    if (named && named !== existing) throw new TypeError(`Graph class name already registered: ${name}`);

    const members = [];
    const names = new Set();
    for (const member of definition.members ?? [])
    {
      if (typeof member.name !== "string" || !member.name) throw new TypeError("Graph member requires a name.");
      if (names.has(member.name)) throw new TypeError(`Duplicate graph member: ${name}.${member.name}`);
      if (!member.handler) throw new TypeError(`Graph member requires a handler: ${name}.${member.name}`);
      names.add(member.name);

      const options = Object.freeze({ ...member.options });
      members.push(Object.freeze({ ...member, options }));
    }
    const declared = Object.freeze({ ...definition, members: Object.freeze(members) });

    const info = existing ?? new CjsGraphClassInfo(ctor, declared);
    if (existing) this._names.delete(existing.declared.name);
    info.declared = declared;
    this._classes.set(ctor, info);
    this._names.set(name, info);

    this._revision++;
    return info;
  }

  /**
   * Returns the registered record with its current compiled description.
   * @cjs Accepts a registered constructor or stable declared name; unknown classes fail.
   */
  static getClassInfo(type)
  {
    const info = typeof type === "string" ? this._names.get(type) : this._classes.get(type);
    if (!info) throw new TypeError("Unknown graph class.");
    if (!info.compiled || info.compiled.revision !== this._revision) info.compiled = this._compile(info);
    return info;
  }

  /**
   * Resolves inherited members without reading or constructing any instance.
   * Modelled on: BlueRttiType::Init (blueexposure/BlueClasses.cpp:82-125).
   * @adapted JS keys replace native offsets; policy flags are retained, not interpreted here.
   */
  static _compile(info)
  {
    const members = [];
    const byName = Object.create(null);
    let parent = null;

    // Preserve candidates in derived-first order. Policy filters BEFORE resolving a name;
    // e.g. a hidden derived declaration must not erase a visible base declaration.
    for (let ctor = info.ctor; typeof ctor === "function"; ctor = Object.getPrototypeOf(ctor))
    {
      const owner = this._classes.get(ctor);
      if (!owner) continue;
      if (owner !== info && !parent) parent = owner;

      for (const member of owner.declared.members)
      {
        const compiled = Object.freeze({ ...member, key: member.key ?? member.name, owner });
        if (!Object.hasOwn(byName, member.name)) byName[member.name] = [];
        byName[member.name].push(compiled);
        members.push(compiled);
      }
    }

    for (const name of Object.keys(byName)) Object.freeze(byName[name]);

    return Object.freeze({
      revision: this._revision,
      parent,
      members: Object.freeze(members),
      byName: Object.freeze(byName)
    });
  }

  /** Stable class identity. */
  static className = "CjsGraph";

}
