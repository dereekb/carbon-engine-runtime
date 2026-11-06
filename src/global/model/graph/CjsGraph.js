import { CjsGraphClassInfo } from "./CjsGraphClassInfo.js";
import { GraphOperation } from "./GraphTypes.js";
import { CjsGraphTypeInvalid } from "./types/CjsGraphTypeInvalid.js";

/**
 * Independent graph declarations and their compiled class records.
 * @cjs Independent registration, declared-edge traversal and value operations.
 */
export class CjsGraph
{

  /** One record per registered constructor. */
  static _classes = new Map();

  /** Stable declared names, never inferred from Function.name. */
  static _names = new Map();

  /** Shared throwing default for members without an assigned value handler. */
  static _invalidHandler = new CjsGraphTypeInvalid();

  /** Invalidates derived descriptions after registration changes, including late parents. */
  static _revision = 0;

  /** Derived selection tables, weakly keyed by immutable selection descriptions. */
  static _selections = new WeakMap();

  /** Reusable traversal storage, isolated by active call depth for nested visitors. */
  static _traversals = [];

  /** Number of currently active synchronous traversals. */
  static _traversalDepth = 0;

  /** The session policy, set at startup; options.policy overrides it per call. */
  static policy = {
    acceptMember(member, info, operation)
    {
      return true;
    },
    complete(object, info, changes, created)
    {
    }
  };

  /**
   * Registers or replaces a class's own definition while retaining its class-info identity.
   * Definition shape: { name, members: [{ name, key?, handler?, ...metadata }] }.
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
      if (member.index !== undefined && (!Number.isSafeInteger(member.index) || member.index < 0))
        throw new TypeError(`Graph member index must be a non-negative integer: ${name}.${member.name}`);
      names.add(member.name);

      const edge = member.edge ? this._compileEdge(member.edge) : null;
      members.push({ ...member, handler: member.handler ?? this._invalidHandler, edge });
    }
    const declared = { ...definition, members };

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
    return this._traverse(root, visit, options, null, null);
  }

  /**
   * Compiles a class-only selection without reading any graph instances.
   * definition: { matchClass(classInfo), edges?, acceptMember(member, classInfo)? }.
   * Predicates must remain stable for the selection lifetime; create a new selection if they change.
   * @cjs Resource matching is supplied by the caller; graph imports no resource services.
   */
  static compileSelection(definition, diagnostics = null)
  {
    if (typeof definition.matchClass !== "function") throw new TypeError("Selection requires matchClass.");
    const selection = {
      matchClass: definition.matchClass,
      acceptMember: definition.acceptMember ?? null,
      edges: Array.from(definition.edges ?? ["embed", "ref"])
    };
    this._selections.set(selection, this._compileSelection(selection, diagnostics));
    return selection;
  }

  /**
   * Appends matching identities in traversal order; output is caller-owned and not cleared.
   * options.prune=false runs the full traversal as the reference result. Both paths use the
   * same compiled eligibility and traversal. Optional stats records visited/matched/skippedEdges/
   * compiledClasses. Registration changes rebuild before walking; diagnostics reports dynamic edges.
   * @cjs Selection assumes valid declared graphs; pruned branches are not validated or read.
   */
  static select(root, selection, output, options = {})
  {
    let compiled = this._selections.get(selection);
    if (!compiled) throw new TypeError("Selection must come from compileSelection.");
    let compiledClasses = 0;
    if (compiled.revision !== this._revision)
    {
      compiled = this._compileSelection(selection, options.diagnostics ?? null);
      this._selections.set(selection, compiled);
      compiledClasses = compiled.classes.size;
    }

    const start = output.length;
    const stats = options.stats;
    if (stats) Object.assign(stats, { visited: 0, matched: 0, skippedEdges: 0, compiledClasses });
    const visited = this._traverse(root, null, options, compiled, output);
    if (stats)
    {
      stats.visited = visited;
      stats.matched = output.length - start;
    }
    return output;
  }

  /**
   * Returns an object's values as a plain bag, written from its compiled members.
   * options: policy; refs (default true) writes a shared object once, then _ref, while false
   * writes it at every reference and a cycle never ends; typeTags writes _type where the class
   * differs from the declared one; forceTypeTags writes it always.
   * Modelled on: YamlWriter::WriteIRoot (blue/src/YamlWriter.cpp:322-376).
   * @cjs Plain values replace YAML events. A second sight anchors the first bag, as YamlWriter does.
   */
  static get(object, options = {})
  {
    return this.getObject(object, null, this._beginGet(options));
  }

  /**
   * Returns one member's value in the same form get writes it.
   * @cjs Resolves the name through the policy, so a member the policy refuses is unknown here.
   */
  static getValue(object, name, options = {})
  {
    const operation = this._beginGet(options);
    const info = this._getObjectInfo(object, null);
    const member = this._getMemberTable(info, operation.policy, GraphOperation.GET).byName[name];
    if (!member) throw new TypeError(`Unknown graph member: ${info.declared.name}.${name}`);

    return this._getMember(object, member, operation);
  }

  /**
   * Writes one object, or an alias to one already written, inside a running get.
   * Object handlers re-enter here; options is the operation get began.
   * Modelled on: YamlWriter::WriteIRoot (blue/src/YamlWriter.cpp:349-376).
   * @cjs _id and _ref replace YAML anchors and aliases.
   */
  static getObject(object, type, options)
  {
    const info = this._getObjectInfo(object, type);

    if (options.refs)
    {
      const written = options.written.get(object);
      if (written)
      {
        written._id ??= options.anchor++;
        return { _ref: written._id };
      }
    }

    const bag = {};
    if (options.refs) options.written.set(object, bag);
    if (options.forceTypeTags || (options.typeTags && (!type || this.getClassInfo(type) !== info))) bag._type = info.declared.name;

    const members = this._getMemberTable(info, options.policy, GraphOperation.GET).members;
    for (let i = 0; i < members.length; i++)
    {
      const member = members[i];
      if (member.index !== undefined && object[member.key][member.index] === null) continue;
      bag[member.name] = this._getMember(object, member, options);
    }

    return bag;
  }

  /** The operation record for one get. @cjs Nothing is allocated per member. */
  static _beginGet(options)
  {
    return {
      policy: options.policy ?? this.policy,
      refs: options.refs !== false,
      typeTags: options.typeTags === true,
      forceTypeTags: options.forceTypeTags === true,
      written: new Map(),
      anchor: 1,
      member: null
    };
  }

  /**
   * Reads one member through its handler; a null never reaches a handler.
   * @cjs member.index selects a slot of the stored array.
   */
  static _getMember(object, member, options)
  {
    const holder = member.index === undefined ? object : object[member.key];
    const key = member.index === undefined ? member.key : member.index;
    if (holder[key] === null) return null;

    options.member = member;
    return member.handler.Get(holder, key, options);
  }

  /**
   * The members a policy accepts for one operation, resolved once per class.
   * @cjs Lives on the compiled record, so a registration change discards it with the rest.
   * Resolves names after filtering, as _selectEdges does.
   */
  static _getMemberTable(info, policy, operation)
  {
    let tables = info.compiled.tables.get(policy);
    if (!tables) info.compiled.tables.set(policy, tables = []);

    let table = tables[operation];
    if (table) return table;

    const members = [], byName = Object.create(null);
    for (const member of info.compiled.members)
    {
      if (byName[member.name] || !policy.acceptMember(member, info, operation)) continue;
      byName[member.name] = member;
      members.push(member);
    }

    table = { members, byName };
    tables[operation] = table;
    return table;
  }

  /** Executes both full enumeration and compiled selection with one iterative walk. @cjs */
  static _traverse(root, visit, options, selection, output)
  {
    const depth = this._traversalDepth++;
    const state = this._traversals[depth] ??= {
      frames: [], seen: new WeakMap(), types: new WeakMap(), pass: 0, classes: new Map()
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
          if (object === null)
          {
            this._clearFrame(frame);
            top--;
            continue;
          }

          const info = this._getObjectInfo(object, frame.type);
          if (state.seen.get(object) === pass)
          {
            if (state.types.get(object) !== info) throw new TypeError("Shared graph struct has conflicting declared types.");
            this._clearFrame(frame);
            top--;
            continue;
          }
          state.seen.set(object, pass);
          state.types.set(object, info);
          count++;

          if (selection)
          {
            const row = selection.classes.get(info);
            if (row.matches) output.push(object);
            frame.members = options.prune === false ? row.full : row.selected;
            if (options.stats) options.stats.skippedEdges += row.full.length - frame.members.length;
          }
          else if (visit(object, info) === false)
          {
            this._clearFrame(frame);
            top--;
            continue;
          }

          else
          {
            let members = state.classes.get(info);
            if (!members)
            {
              members = this._selectEdges(info, options);
              state.classes.set(info, members);
            }
            frame.members = members;
          }
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

    return { kind: edge.kind, type: edge.type ?? null, collection: edge.collection ?? false };
  }

  /** Resolves actual classes, using the declared type only for plain struct storage. @cjs */
  static _getObjectInfo(object, type)
  {
    if (typeof object !== "object") throw new TypeError("Graph edge requires an object.");
    const prototype = Object.getPrototypeOf(object);
    const plain = prototype === Object.prototype || prototype === null;
    if (type)
    {
      const declared = this.getClassInfo(type);
      if (plain) return declared;
      let current = prototype;
      while (current && current !== declared.ctor.prototype) current = Object.getPrototypeOf(current);
      if (!current) throw new TypeError(`Graph edge is not assignable to ${declared.declared.name}.`);
    }
    if (plain) throw new TypeError("Graph edge has no declared type for a plain object.");
    return this.getClassInfo(prototype.constructor);
  }

  /**
   * Derives reachability by propagating matches/dynamic edges through reverse dependencies.
   * @cjs Cycles need no recursion or repeated whole-registry fixed-point scan. Registered derived
   * classes are possible targets too. Unknown targets remain conservative until registration.
   */
  static _compileSelection(selection, diagnostics)
  {
    const revision = this._revision;
    const classes = new Map(), descendants = new Map(), prototypes = new Map();
    const queue = [];

    for (const info of this._classes.values()) prototypes.set(info.ctor.prototype, info);

    for (const info of this._classes.values())
    {
      this.getClassInfo(info.ctor);
      const full = this._selectEdges(info, selection);
      const matches = !!selection.matchClass(info);
      if (revision !== this._revision) throw new Error("Graph declarations changed during selection compilation.");

      const row = { info, full, matches, reachable: matches, parents: [], dependencies: [], selected: [] };
      classes.set(info, row);
      if (matches) queue.push(row);

      // Use the same instance-prototype relation as runtime assignability, including
      // classes whose prototype inheritance was established without `extends`.
      for (let prototype = info.ctor.prototype; prototype; prototype = Object.getPrototypeOf(prototype))
      {
        const base = prototypes.get(prototype);
        if (!base) continue;
        let targets = descendants.get(base);
        if (!targets) descendants.set(base, targets = []);
        targets.push(row);
      }
    }

    for (const row of classes.values())
    {
      for (const member of row.full)
      {
        const type = member.edge.type;
        const target = typeof type === "string" ? this._names.get(type) : this._classes.get(type);
        const targets = target ? descendants.get(target) : null;
        row.dependencies.push({ member, targets });
        if (targets)
        {
          for (const child of targets) child.parents.push(row);
        }
        else
        {
          if (!row.reachable)
          {
            row.reachable = true;
            queue.push(row);
          }
          if (diagnostics) diagnostics.push({
            className: row.info.declared.name, member: member.name,
            reason: type == null ? "dynamic" : "unregistered target"
          });
        }
      }
    }

    for (let i = 0; i < queue.length; i++)
    {
      for (const parent of queue[i].parents)
      {
        if (parent.reachable) continue;
        parent.reachable = true;
        queue.push(parent);
      }
    }

    for (const row of classes.values())
    {
      for (const dependency of row.dependencies)
      {
        let reachable = !dependency.targets;
        if (dependency.targets)
        {
          for (const target of dependency.targets)
          {
            if (target.reachable) { reachable = true; break; }
          }
        }
        if (reachable) row.selected.push(dependency.member);
      }
      // Only the warm execution data survives; discard compilation's dependency graph.
      row.parents = null;
      row.dependencies = null;
    }
    return { revision, classes };
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
    // The instance prototype chain, the same relation traversal and selection use.
    for (let prototype = info.ctor.prototype; prototype; prototype = Object.getPrototypeOf(prototype))
    {
      const owner = this._classes.get(prototype.constructor);
      if (!owner) continue;
      if (owner !== info && !parent) parent = owner;

      for (const member of owner.declared.members)
      {
        const compiled = { ...member, key: member.key ?? member.name, owner };
        if (!Object.hasOwn(byName, member.name)) byName[member.name] = [];
        byName[member.name].push(compiled);
        members.push(compiled);
      }
    }

    return { revision: this._revision, parent, members, byName, tables: new WeakMap() };
  }

  /** Stable class identity. */
  static className = "CjsGraph";

}
