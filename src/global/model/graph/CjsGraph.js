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

  /**
   * Class libraries, oldest first. The graph's own definitions are the oldest, so a
   * registered library replaces them by name.
   */
  static _libraries = [ {
    Get(typeName)
    {
      return CjsGraph._names.get(typeName)?.ctor;
    },
    Create(typeName)
    {
      return new (this.Get(typeName))();
    }
  } ];

  /** Value keys that are not members. */
  static _reserved = new Set([ "_type", "_id", "_ref" ]);

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
   * Registers a class library that defines _type names; the last registered wins.
   * library.Get(typeName) returns the class, or nothing; library.Create(typeName) creates one.
   * @cjs Blue's classes are one library, and our own classes can be another.
   */
  static registerLibrary(library)
  {
    this._libraries.push(library);
    return library;
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
   * differs from the declared one; forceTypeTags writes it always; copyOverride(object) may
   * return an object to hold in place of writing a held one, which set then keeps as a reference.
   * Modelled on: YamlWriter::WriteIRoot (blue/src/YamlWriter.cpp:322-376).
   * @cjs Plain values replace YAML events. A second sight anchors the first bag, as YamlWriter does.
   */
  static get(object, options = {})
  {
    return this._writeObject(object, null, this._beginGet(options));
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
   * Writes values into an existing object: equal members are skipped, and each changed member
   * is recorded. A nested object read in place records a nested bag, a replaced reference
   * records the live object, and a changed list records its whole new plain array, so the
   * record can be replayed through set. Returns that record, or false when nothing changed.
   * options: policy; validate (default true) runs each handler's IsValidValue on the incoming value;
   * idMap, a Map of id to object, is this set's _id table: its entries resolve _ref, and a record
   * then holds _ref in place of a live object, with the map holding the object; initializeHeld
   * (default true) counts an object read into under a created owner as created, as Copier
   * initialises every object it fills (Copier.cpp:141, :209).
   * A nested object completes as its own set would, so its owner is told only of its own members.
   * Nothing is completed until references resolve. A failure stops the operation with no
   * rollback of writes already made, and nothing is completed.
   * Modelled on: Blue::DictReader::ReadMembers, without its notification during the walk.
   * @cjs The door's rules (specifications/model-values-interchange.md), not Carbon's reader.
   */
  static set(object, values, options = {})
  {
    if (!this._isValues(values, "set")) return false;

    const operation = this._beginSet(options);
    const changes = this.setObject(object, values, null, operation);
    this._finish(operation);
    return changes;
  }

  /**
   * Tells the policy an object's members changed, for writes that went round set: a direct
   * field or array write followed by this call. No names means every member, so this is the
   * broad call; a name or an array of names narrows it. Keeps no baseline, so it compares
   * nothing. Returns what it reported, or false for no members.
   * A held object is reported by reference, and its own members are not walked.
   * @cjs Our contract for direct writes (projects/graph-root-object.md section 6).
   */
  static updateValues(object, names = null, options = {})
  {
    const operation = this._beginSet(options);
    const info = this._getObjectInfo(object, null);
    const table = this._getMemberTable(info, operation.policy, GraphOperation.SET);
    const members = names === null ? table.members : (typeof names === "string" ? [ names ] : names);

    let changes = false;

    for (let i = 0; i < members.length; i++)
    {
      const member = names === null ? members[i] : table.byName[members[i]];

      if (!member)
      {
        if (info.compiled.byName[members[i]]) continue;
        throw new TypeError(`Unknown graph member: ${info.declared.name}.${members[i]}`);
      }

      if (changes === false) changes = {}; // alloc: only once a member is reported.
      changes[member.name] = this._getReported(object, member, operation);
      if (member.edge !== null && operation.idMap !== null) operation.recorded.push(changes, member.name);
    }

    if (changes !== false) this._addCompletion(object, info, changes, null, operation);
    this._finish(operation);

    return changes;
  }

  /** One member as updateValues reports it: a leaf in Get form, a held object by reference. @cjs */
  static _getReported(object, member, options)
  {
    if (member.edge === null) return this._getMember(object, member, options);

    const stored = member.index === undefined ? object[member.key] : object[member.key][member.index];
    return member.edge.collection && stored !== null ? Array.from(stored) : stored;
  }

  /**
   * Writes one member through set.
   * @cjs
   */
  static setValue(object, name, value, options)
  {
    return this.set(object, { [name]: value }, options);
  }

  /**
   * Creates an object and sets its values, then completes it once references resolve.
   * type is a constructor, a registered name, or null when values names its own _type.
   * options as set; valuesMode returns plain values instead, leaving _type as data.
   * @cjs create + set + complete. An unknown class is an error, never a plain object.
   */
  static from(type, values, options = {})
  {
    if (!this._isValues(values, "from")) values = {};
    if (options.valuesMode === true) return this._copyValues(values);

    const operation = this._beginSet(options);
    const object = this.createObject(values, type, operation);
    this._finish(operation);
    return object;
  }

  /**
   * Copies values between two objects: get then set. The target keeps its identity.
   * Nothing outside the source is shared, as Carbon's Copier copies recursively and shares only
   * within one copy (Copier.cpp:73-98). options.copyOverride shares more, as m_override does.
   * @cjs A preset, not Carbon's Copier.
   */
  static copy(source, target, options = {})
  {
    return this.set(target, this.get(source, { ...options, typeTags: true }), { ...options, validate: false });
  }

  /**
   * Creates a separate graph with the same values and topology: get then from.
   * Sharing follows copy.
   * @cjs A preset, not Carbon's Copier.
   */
  static clone(source, options = {})
  {
    return this.from(null, this.get(source, { ...options, typeTags: true }), { ...options, validate: false });
  }

  /**
   * Writes one object, or an alias to one already written, inside a running get.
   * Object handlers re-enter here; options is the operation get began.
   * Modelled on: YamlWriter::WriteIRoot (blue/src/YamlWriter.cpp:349-376).
   * @cjs _id and _ref replace YAML anchors and aliases.
   * The override is Copier::m_override (Copier.cpp:47-58): undefined continues, and a failure throws.
   */
  static getObject(object, type, options)
  {
    if (options.copyOverride !== null)
    {
      const held = options.copyOverride(object);
      if (held !== undefined) return held;
    }

    return this._writeObject(object, type, options);
  }

  /** Writes an object's bag, or an alias to one already written. @cjs */
  static _writeObject(object, type, options)
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

  /**
   * Reads values into an existing object inside a running set.
   * @cjs Object handlers re-enter here; options is the operation set began.
   */
  static setObject(object, values, type, options)
  {
    const info = this._getObjectInfo(object, type);

    if (values._type !== undefined && !this.isType(object, values._type))
      throw new TypeError(`Expected ${info.declared.name} but got _type ${values._type}`);

    const creating = options.creating;
    options.creating = creating && options.initializeHeld;
    const changes = this._setMembers(object, info, values, options);
    options.creating = creating;

    return changes;
  }

  /**
   * Creates the object a bag describes inside a running set, and reads the bag into it.
   * @cjs Objects read into under a creation count as created unless options.initializeHeld is
   * false: nobody has initialised them.
   */
  static createObject(values, type, options)
  {
    const typeName = values._type ?? (typeof type === "function" ? this.getClassInfo(type).declared.name : type);
    if (!typeName) throw new TypeError("Graph value names no class: it has no _type, and its member declares none.");

    const object = this._create(typeName);
    const info = this._getObjectInfo(object, type);
    const creating = options.creating;

    options.creating = true;
    this._setMembers(object, info, values, options);
    options.creating = creating;

    return object;
  }

  /**
   * Whether an object is an instance of a named class.
   * @cjs Resolves through the class libraries; an unknown name is an error.
   */
  static isType(object, typeName)
  {
    return this._getClass(typeName).prototype.isPrototypeOf(object);
  }

  /** Whether a value is a plain object, a bag rather than a live object. @cjs */
  static isPlain(value)
  {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  /**
   * Records a reference to an _id not seen yet, written once references resolve.
   * @cjs JS forward aliases postpone the write. record and recordKey name where the
   * change record keeps this object.
   */
  static deferReference(holder, key, id, type, record, recordKey, options)
  {
    const entry = { holder, key, id, type, record, recordKey, fill: null };
    options.pending.push(entry);
    return entry;
  }

  /**
   * Records an embedded object to fill by value from an _id.
   * @cjs A struct has no identity to alias, so the fixup copies once every source is read,
   * even for a known _id: its object can still be waiting, or part read. The value's own
   * _id names the held object, so another waiter can chain through it.
   */
  static deferValues(fill, value, type, options)
  {
    if (value._id !== undefined) this._setAnchor(value._id, fill, options);

    const entry = { holder: null, key: null, id: value._ref, type, record: null, recordKey: null, fill };
    options.pending.push(entry);
    return entry;
  }

  /** Whether a value is a _ref. @cjs */
  static isReference(value)
  {
    return this.isPlain(value) && value._ref !== undefined;
  }

  /**
   * Tests whether a value already describes an object, writing nothing.
   * @cjs Compares only what the value names. An _id is recorded as it is read, because a
   * later _ref in the same value names it; a _ref not yet known is no match.
   */
  static isObjectLike(object, value, type, options)
  {
    if (object === null || value === null) return object === value;
    if (!this.isPlain(value)) return object === value;
    if (value._ref !== undefined) return options.anchors.get(value._ref) === object;
    if (value._type !== undefined && !this.isType(object, value._type)) return false;

    const info = this._getObjectInfo(object, type);
    if (value._id !== undefined) this._setAnchor(value._id, object, options);

    const members = this._getMemberTable(info, options.policy, GraphOperation.SET).byName;
    for (const name of Object.keys(value))
    {
      const member = members[name];

      if (!member)
      {
        if (this._reserved.has(name) || info.compiled.byName[name]) continue;
        return false;
      }

      const holder = member.index === undefined ? object : object[member.key];
      const key = member.index === undefined ? member.key : member.index;
      if (!this._isValueLike(holder[key], member, value[name], options)) return false;
    }

    return true;
  }

  /** Tests whether a list already holds what a plain array describes, writing nothing. @cjs */
  static isListLike(list, values, type, options)
  {
    if (list.length !== values.length) return false;

    for (let i = 0; i < list.length; i++)
    {
      if (!this.isObjectLike(list[i], values[i], type, options)) return false;
    }

    return true;
  }

  /**
   * Returns the bag an embedded object is read from.
   * @cjs Embedded storage keeps its identity, so a live object is copied by its values.
   * A _ref goes through deferValues instead.
   */
  static getEmbeddedValues(value, options)
  {
    return this.isPlain(value) ? value : this.get(value, { policy: options.policy, refs: false });
  }

  /** The operation record for one get. @cjs Nothing is allocated per member. */
  static _beginGet(options)
  {
    return {
      policy: options.policy ?? this.policy,
      refs: options.refs !== false,
      typeTags: options.typeTags === true,
      forceTypeTags: options.forceTypeTags === true,
      copyOverride: options.copyOverride ?? null,
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

  /** The operation record for one set or from. @cjs Nothing is allocated per member. */
  static _beginSet(options)
  {
    return {
      policy: options.policy ?? this.policy,
      validate: options.validate !== false,
      initializeHeld: options.initializeHeld !== false,
      anchors: options.idMap ?? new Map(),
      idMap: options.idMap ?? null,
      ids: null,
      nextId: 1,
      recorded: [],
      pending: [],
      completions: new Map(),
      creating: false,
      member: null,
      deferred: null
    };
  }

  /**
   * Writes each named member, recording what changed.
   * @cjs A policy-refused member is skipped, as DictReader skips a member it may not write,
   * and a name the class does not declare fails. A null bypasses a leaf handler.
   */
  static _setMembers(object, info, values, options)
  {
    if (values._id !== undefined) this._setAnchor(values._id, object, options);

    const members = this._getMemberTable(info, options.policy, GraphOperation.SET).byName;
    const names = Object.keys(values);
    let changes = false;
    let nested = null;

    for (let i = 0; i < names.length; i++)
    {
      const name = names[i];
      const member = members[name];

      if (!member)
      {
        if (this._reserved.has(name) || info.compiled.byName[name]) continue;
        throw new TypeError(`Unknown graph member: ${info.declared.name}.${name}`);
      }

      const value = values[name];
      if (options.validate && value !== null && !member.handler.IsValidValue(value))
        throw new TypeError(`Invalid value for graph member: ${info.declared.name}.${name}`);

      const holder = member.index === undefined ? object : object[member.key];
      const key = member.index === undefined ? member.key : member.index;

      options.member = member;
      const result = value === null && member.edge === null
        ? this._clear(holder, key)
        : member.handler.Set(holder, key, value, options);

      if (result === false) continue;
      if (changes === false) changes = {}; // alloc: only once something changed.

      if (options.deferred !== null)
      {
        options.deferred.record = changes;
        options.deferred.recordKey = name;
        options.deferred = null;
        changes[name] = null;
      }
      else changes[name] = result === true ? this._getMember(object, member, options) : result;

      if (member.edge === null) continue;
      if (options.idMap !== null) options.recorded.push(changes, name);

      // A nested bag is the child's own change: only the child's completion tells of it.
      if (!member.edge.collection && result !== true && this.isPlain(result)) (nested ??= []).push(name);
    }

    if (changes !== false || options.creating) this._addCompletion(object, info, changes, nested, options);

    return changes;
  }

  /**
   * The members an object changed itself, without its nested bags, or false.
   * @cjs Runs once references resolve, so a forward reference is already in the record.
   */
  static _getOwnChanges(changes, nested)
  {
    if (nested === null || changes === false) return changes;

    const names = Object.keys(changes);
    if (names.length === nested.length) return false;

    const own = {}; // alloc: only when an object changed both itself and a child.
    for (const name of names)
    {
      if (!nested.includes(name)) own[name] = changes[name];
    }

    return own;
  }

  /** Records an _id, keeping the reverse table current once it exists. @cjs */
  static _setAnchor(id, object, options)
  {
    options.anchors.set(id, object);
    if (options.ids !== null) options.ids.set(object, id);
  }

  /**
   * The id of an object in the _id table, adding it when it has none.
   * @cjs Runs at the end of a set, so a new id cannot collide with one the values name.
   */
  static _getId(object, options)
  {
    if (options.ids === null)
    {
      options.ids = new Map(); // alloc: only an idMap caller builds the reverse table.
      for (const [ id, known ] of options.anchors) options.ids.set(known, id);
    }

    let id = options.ids.get(object);
    if (id !== undefined) return id;

    do id = options.nextId++;
    while (options.anchors.has(id));

    this._setAnchor(id, object, options);
    return id;
  }

  /** Replaces a record's live object, or those in its list, with _ref. @cjs idMap only. */
  static _recordReferences(record, name, options)
  {
    const value = record[name];

    if (Array.isArray(value))
    {
      for (let i = 0; i < value.length; i++)
      {
        if (value[i] !== null) value[i] = { _ref: this._getId(value[i], options) };
      }
    }
    else if (value !== null && !this.isPlain(value)) record[name] = { _ref: this._getId(value, options) };
  }

  /** Writes a null over a leaf value. @cjs */
  static _clear(holder, key)
  {
    if (holder[key] === null) return false;

    holder[key] = null;
    return true;
  }

  /**
   * Compares one stored value with incoming input, as set would.
   * @cjs Runs IsValidValue itself: this input has not been through _setMembers.
   */
  static _isValueLike(stored, member, value, options)
  {
    if (stored === null || value === null) return stored === value;

    if (options.validate && !member.handler.IsValidValue(value))
      throw new TypeError(`Invalid value for graph member: ${member.owner.declared.name}.${member.name}`);

    if (member.edge === null) return member.handler.IsUnchanged(stored, value);
    if (member.edge.collection) return this.isListLike(stored, value, member.edge.type, options);

    return this.isObjectLike(stored, value, member.edge.type, options);
  }

  /** Records an object for completion, once, children before parents. @cjs */
  static _addCompletion(object, info, changes, nested, options)
  {
    const entry = options.completions.get(object);

    if (!entry)
    {
      options.completions.set(object, { object, info, changes, nested, created: options.creating });
      return;
    }

    if (changes !== false) entry.changes = entry.changes === false ? changes : Object.assign(entry.changes, changes);
    if (nested !== null) entry.nested = entry.nested === null ? nested : entry.nested.concat(nested);
  }

  /**
   * Resolves forward references, then completes every changed or created object.
   * @cjs Nothing is told before references resolve, so a failure here notifies nothing.
   */
  static _finish(options)
  {
    for (const entry of options.pending)
    {
      const object = options.anchors.get(entry.id);
      if (object === undefined) throw new TypeError(`Unresolved _ref: ${entry.id}`);

      this._getObjectInfo(object, entry.type);
      if (entry.fill !== null) continue;

      entry.holder[entry.key] = object;
      entry.record[entry.recordKey] = object;
    }

    // Fills read references, so they run after every write above.
    for (const entry of options.pending)
    {
      if (entry.fill !== null) this._fill(entry, options);
    }

    for (let i = 0; i < options.recorded.length; i += 2)
    {
      this._recordReferences(options.recorded[i], options.recorded[i + 1], options);
    }

    for (const entry of options.completions.values())
    {
      const own = this._getOwnChanges(entry.changes, entry.nested);
      if (own !== false || entry.created) options.policy.complete(entry.object, entry.info, own, entry.created);
    }
  }

  /**
   * Copies a forward _ref's values into an embedded object.
   * @cjs A source that is itself waiting fills first. The cleared fill ends a cycle.
   */
  static _fill(entry, options)
  {
    const target = entry.fill;
    if (target === null) return;
    entry.fill = null;

    const source = options.anchors.get(entry.id);
    for (const other of options.pending)
    {
      if (other.fill === source) this._fill(other, options);
    }

    if (source === target) return;

    this._setMembers(target, this._getObjectInfo(target, entry.type), this.getEmbeddedValues(source, options), options);
    if (entry.record !== null) entry.record[entry.recordKey] = target;
  }

  /** Applies the top-level values rule: a plain object, or null for no values. @cjs */
  static _isValues(values, operation)
  {
    if (values === null) return false;

    if (typeof values !== "object" || Array.isArray(values) || !this.isPlain(values))
      throw new TypeError(`Graph ${operation} requires plain values.`);

    return true;
  }

  /** The newest library's class for a name. @cjs */
  static _getClass(typeName)
  {
    for (let i = this._libraries.length - 1; i >= 0; i--)
    {
      const ctor = this._libraries[i].Get(typeName);
      if (ctor) return ctor;
    }

    throw new TypeError(`Unknown graph class: ${typeName}`);
  }

  /** Creates an instance through the newest library that names the class. @cjs */
  static _create(typeName)
  {
    for (let i = this._libraries.length - 1; i >= 0; i--)
    {
      if (this._libraries[i].Get(typeName)) return this._libraries[i].Create(typeName);
    }

    throw new TypeError(`Unknown graph class: ${typeName}`);
  }

  /** Copies plain values, leaving _type, _id and _ref as data. @cjs Values mode. */
  static _copyValues(value)
  {
    if (value === null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(item => this._copyValues(item));
    if (ArrayBuffer.isView(value)) return Array.from(value);
    if (!this.isPlain(value)) throw new TypeError("Graph values mode requires plain values.");

    const copy = {};
    for (const name of Object.keys(value)) copy[name] = this._copyValues(value[name]);
    return copy;
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
