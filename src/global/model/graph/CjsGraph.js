import { CjsGraphClassInfo } from "./CjsGraphClassInfo.js";

/**
 * Independent graph declarations and their compiled class records.
 * @cjs Independent registration and declared-edge traversal; value operations follow separately.
 */
export class CjsGraph
{

  /** One record per registered constructor. */
  static _classes = new Map();

  /** Stable declared names, never inferred from Function.name. */
  static _names = new Map();

  /** Invalidates derived descriptions after registration changes, including late parents. */
  static _revision = 0;

  /** Reusable traversal storage, isolated by active call depth for nested visitors. */
  static _traversals = [];

  /** Number of currently active synchronous traversals. */
  static _traversalDepth = 0;

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
      if (member.index !== undefined && (!Number.isSafeInteger(member.index) || member.index < 0))
        throw new TypeError(`Graph member index must be a non-negative integer: ${name}.${member.name}`);
      names.add(member.name);

      const options = Object.freeze({ ...member.options });
      const edge = member.edge ? this._compileEdge(member.edge) : null;
      members.push(Object.freeze({ ...member, options, edge }));
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
   * Visits registered objects once, depth-first, in eligible declaration/list order.
   * visit(object, classInfo) may return false to skip that object's children.
   * options.edges selects embed/ref/weak edges (default embed and ref);
   * options.acceptMember(member, classInfo) filters BEFORE inherited name resolution.
   * @cjs Synchronous read-only traversal, not Set's payload/reference processing.
   * Uses weak side-table pass marks so plain registered instances need no added fields.
   * Nested calls have their own marks and stack; no graph objects survive in idle frames.
   */
  static traverse(root, visit, options = {})
  {
    const depth = this._traversalDepth++;
    const state = this._traversals[depth] ??= {
      frames: [], seen: new WeakMap(), pass: 0, classes: new Map()
    };
    if (state.pass === Number.MAX_SAFE_INTEGER)
    {
      state.seen = new WeakMap();
      state.pass = 0;
    }
    const pass = ++state.pass;
    const revision = this._revision;
    let top = 0, count = 0;
    this._setFrame(state.frames, top, root, null);

    try
    {
      while (top >= 0)
      {
        if (revision !== this._revision) throw new Error("Graph declarations changed during traversal.");
        const frame = state.frames[top];

        if (!frame.members)
        {
          const object = frame.object;
          if (object === null || state.seen.get(object) === pass)
          {
            this._clearFrame(frame);
            top--;
            continue;
          }

          const info = this._getObjectInfo(object, frame.type);
          state.seen.set(object, pass);
          count++;
          if (visit(object, info) === false)
          {
            this._clearFrame(frame);
            top--;
            continue;
          }

          let members = state.classes.get(info);
          if (!members)
          {
            members = this._selectEdges(info, options);
            state.classes.set(info, members);
          }
          frame.members = members;
        }

        if (revision !== this._revision) throw new Error("Graph declarations changed during traversal.");

        // Continue a collection before reading the next declared member.
        if (frame.items && frame.itemIndex < frame.items.length)
        {
          const child = frame.items[frame.itemIndex++];
          this._setFrame(state.frames, ++top, child, frame.type);
          continue;
        }
        frame.items = null;

        if (frame.memberIndex === frame.members.length)
        {
          this._clearFrame(frame);
          top--;
          continue;
        }

        const member = frame.members[frame.memberIndex++];
        const stored = frame.object[member.key];
        if (member.index !== undefined && (!Array.isArray(stored) || member.index >= stored.length))
          throw new TypeError(`Graph member index is outside its storage: ${member.name}`);
        const value = member.index === undefined ? stored : stored[member.index];
        if (value === undefined) throw new TypeError(`Graph edge is undefined: ${member.name}`);
        if (member.edge.collection)
        {
          if (!Array.isArray(value)) throw new TypeError(`Graph collection must be an array: ${member.name}`);
          frame.items = value;
          frame.itemIndex = 0;
          frame.type = member.edge.type;
        }
        else
        {
          this._setFrame(state.frames, ++top, value, member.edge.type);
        }
      }

      if (revision !== this._revision) throw new Error("Graph declarations changed during traversal.");
      return count;
    }
    finally
    {
      for (; top >= 0; top--) this._clearFrame(state.frames[top]);
      state.classes.clear();
      this._traversalDepth--;
    }
  }

  /**
   * Snapshots an explicit object/struct edge; an omitted type is dynamic.
   * @cjs Ownership is retained independently of collection shape and target class.
   */
  static _compileEdge(edge)
  {
    if (edge.kind !== "embed" && edge.kind !== "ref" && edge.kind !== "weak")
      throw new TypeError("Graph edge requires embed, ref or weak ownership.");
    if (edge.type != null && typeof edge.type !== "function" && typeof edge.type !== "string")
      throw new TypeError("Graph edge type requires a constructor or registered name.");
    if (edge.collection !== undefined && typeof edge.collection !== "boolean")
      throw new TypeError("Graph edge collection must be boolean.");

    return Object.freeze({ kind: edge.kind, type: edge.type ?? null, collection: edge.collection ?? false });
  }

  /** Resolves actual classes, using the declared type only for plain struct storage. @cjs */
  static _getObjectInfo(object, type)
  {
    if (typeof object !== "object") throw new TypeError("Graph edge requires an object.");
    const prototype = Object.getPrototypeOf(object);
    if (type && (prototype === Object.prototype || prototype === null)) return this.getClassInfo(type);
    return this.getClassInfo(prototype?.constructor);
  }

  /** Resolves eligible names before edge filtering, once per class per traversal. @cjs */
  static _selectEdges(info, options)
  {
    const selected = new Map();
    const edges = options.edges ?? ["embed", "ref"];
    for (const member of info.compiled.members)
    {
      if (selected.has(member.name)) continue;
      if (options.acceptMember && !options.acceptMember(member, info)) continue;
      selected.set(member.name, member);
    }

    const members = [];
    for (const member of selected.values())
    {
      if (member.edge && edges.includes(member.edge.kind)) members.push(member);
    }
    return members;
  }

  /** Reuses a depth frame rather than allocating one per visited object. @cjs */
  static _setFrame(frames, index, object, type)
  {
    const frame = frames[index] ??= {
      object: null, type: null, members: null, memberIndex: 0, items: null, itemIndex: 0
    };
    frame.object = object;
    frame.type = type;
    frame.memberIndex = 0;
    frame.itemIndex = 0;
  }

  /** Releases all graph/declaration references when a frame completes or fails. @cjs */
  static _clearFrame(frame)
  {
    frame.object = null;
    frame.type = null;
    frame.members = null;
    frame.items = null;
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
