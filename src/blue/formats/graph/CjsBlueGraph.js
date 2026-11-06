// Blue's side of the independent graph (global/model/graph), which imports nothing of ours.
// Blue supplies its classes, as definitions and as a class library, and its rules, as a policy.
// Disconnected: DictReader and DictWriter stay the live path until the one reviewed cutover.
import * as graph from "../../../global/model/graph/index.js";
import { BLUELISTEVENT } from "#consts/blue";
import { CjsSchema } from "#schema";
import { mappedInterfaces } from "../../compose/interface.js";
import { isExportableField, isWritableField } from "../../compose/values.js";
import { BlueClasses } from "../../exposure/BlueClasses.js";
import { getClassRegistrations, getRegisteredConstructor } from "../../exposure/classes/registry.js";
import { IInitialize } from "../../exposure/IInitialize.js";
import { IList } from "../../exposure/IList.js";
import { IListNotify } from "../../exposure/IListNotify.js";
import { INotify } from "../../exposure/INotify.js";
import { IRootReaderBase } from "../../format/IRootReaderBase.js";
import { DeclaredClassName } from "../../format/IRootWriter.js";

const { CjsGraph, GraphOperation } = graph;

const handler = name => new graph[`CjsGraphType${name}`]();

/** One shared handler per declared schema kind; a class never allocates its own. */
const KIND_HANDLERS = {
  float32: handler("Float32"), float64: handler("Float64"), boolean: handler("Boolean"),
  int8: handler("Int8"), uint8: handler("Uint8"), int16: handler("Int16"), uint16: handler("Uint16"),
  int32: handler("Int32"), uint32: handler("Uint32"), int64: handler("Int64"), uint64: handler("Uint64"),
  string: handler("String"), path: handler("String"), expression: handler("String"),
  wstring: handler("WString"), wpath: handler("WString"),
  vec2: handler("Vector2"), vec3: handler("Vector3"), vec4: handler("Vector4"),
  quat: handler("Quaternion"), color: handler("Color"), mat4: handler("Matrix"),
  rootRef: handler("IRootPtr"), rootWeak: handler("IRootWeakRef"), root: handler("IRoot"), rawStruct: handler("Struct"),
  list: handler("List"), structList: handler("List")
};

/**
 * Classes a member may hold beyond what they inherit or map. A legacy Tr2ShaderMaterial sits in
 * Tr2MeshArea.effect until the owner converts it, as its class comment records.
 */
const HELD_AS = { Tr2ShaderMaterial: [ "Tr2Effect" ] };

/** One shared handler per item kind, for a list of plain values. */
const VALUE_HANDLERS = {};

/** The one handler for a Map of objects. */
const MAP_HANDLER = handler("Map");

/** How each object kind holds its object. */
const KIND_EDGES = { rootRef: "ref", rootWeak: "weak", root: "embed", rawStruct: "embed", list: "ref", structList: "embed" };

/**
 * Blue's rules for the graph: which members, and what an object is told.
 * @cjs Our policy over the graph's two hooks. It decides and never walks.
 */
export class CjsBlueGraphPolicy
{

  /** Write only PERSIST members. */
  persistOnly = false;

  /** Write only members a read takes back, for a round trip. */
  roundTrip = false;

  /** Run Initialize and OnModified; false reads without them, as a reader's initialize option does. */
  notify = true;

  /**
   * @param {{persistOnly?: boolean, roundTrip?: boolean, notify?: boolean}} [options={}] Choices.
   */
  constructor({ persistOnly = false, roundTrip = false, notify = true } = {})
  {
    this.persistOnly = persistOnly;
    this.roundTrip = roundTrip;
    this.notify = notify;
  }

  /**
   * Carbon's flags, through the same tests the values transport uses.
   * @cjs
   * @param {object} member Compiled graph member.
   * @param {object} info Graph class info.
   * @param {number} operation GraphOperation.
   * @returns {boolean} Whether the operation sees the member.
   */
  acceptMember(member, info, operation)
  {
    // A values bag carries no binary block (DictWriter.WriteBinaryBlock).
    if (member.field.type?.binary === true) return false;
    if (operation === GraphOperation.GET) return isExportableField(member.field, this);

    return isWritableField(member.field);
  }

  /**
   * Writes a changed list of an existing owner, with Carbon's list events.
   * A mapped list uses its own operations and observer, as IRootReader::ReadList does; an
   * ordinary array on an IListNotify owner sends the same events from the owner.
   * Modelled on: DictReader._ReadIList and _ReadLiveList.
   * @cjs UNLOADSTART runs with the old items still in the list.
   * @param {object} owner The list's owner.
   * @param {object} member Compiled graph member.
   * @param {Array} list The list.
   * @param {Array} items The new contents.
   * @returns {void}
   */
  replaceList(owner, member, list, items)
  {
    if (this.notify && mappedInterfaces(list.constructor).has(IList))
    {
      this._replaceMappedList(list, items);
      return;
    }

    const notify = this.notify ? CjsSchema.cast(owner, IListNotify) : null;

    if (notify !== null && list.length) notify.OnListModified(BLUELISTEVENT.BELIST_UNLOADSTART, 0, 0, null, list);

    list.length = 0;

    for (const item of items)
    {
      list.push(item);
      if (notify !== null && item !== null) notify.OnListModified(BLUELISTEVENT.BELIST_INSERTED, list.length, 0, item, list);
    }
  }

  /**
   * Refills a mapped list through Remove and Append, with its observer quiet for the fill.
   * @cjs As DictReader._ReadIList, which follows ReadList's clear then append.
   */
  _replaceMappedList(list, items)
  {
    const info = {};

    list.GetInfo(info);
    list.Remove(-1);
    list.SetNotify(null);

    for (const item of items)
    {
      if (item !== null) list.Append(item);
    }

    list.SetNotify(info.notify);
    if (info.notify) info.notify.OnListModified(BLUELISTEVENT.BELIST_LOADFINISHED, 0, 0, null, list);
  }

  /**
   * A created IInitialize object is initialised once. Otherwise each changed NOTIFY member
   * is told to INotify, in order.
   * Carbon: Copier::CopyToInternal (blueexposure/Copier.cpp:141, :209) for the created case.
   * @cjs On an existing object the door's rule holds: only members it changed are told.
   * @param {object} object The object.
   * @param {object} info Graph class info.
   * @param {object|false} changes What changed.
   * @param {boolean} created Whether this operation created it.
   * @returns {void}
   */
  complete(object, info, changes, created)
  {
    if (!this.notify) return;

    if (created)
    {
      const initialize = CjsSchema.cast(object, IInitialize);

      if (initialize)
      {
        initialize.Initialize();
        return;
      }
    }

    const notify = changes === false ? null : CjsSchema.cast(object, INotify);
    if (notify === null) return;

    const members = info.compiled.byName;
    for (const name of Object.keys(changes))
    {
      if (members[name][0].field.edit?.notify) notify.OnModified(name);
    }
  }

  /** Stable class identity. */
  static className = "CjsBlueGraphPolicy";

}

/**
 * Registers Blue's classes with the graph, from the same declarations the values path reads.
 * @cjs Our adapter: the graph may not import the schema.
 */
export class CjsBlueGraph
{

  /**
   * Defines every registered class that has no definition yet, and adds Blue's class library.
   * @param {BlueClasses} classes The class library, normally blue.classes.
   * @returns {void}
   */
  static register(classes)
  {
    for (const { name, type } of getClassRegistrations())
    {
      if (!CjsGraph.isDefined(type)) this.define(type, name);
    }

    CjsGraph.registerLibrary(classes);
  }

  /**
   * Defines one class from its transported declarations.
   * @param {Function} ctor The class.
   * @param {string} name Its registered name.
   * @returns {object} Graph class info.
   */
  static define(ctor, name)
  {
    const { fields } = IRootReaderBase.getDictionaryDeclarations(ctor);

    return CjsGraph.define(ctor, {
      name,
      whole: true,
      interfaces: [ ...Array.from(mappedInterfaces(ctor), mapped => CjsSchema.getClassName(mapped)), ...HELD_AS[name] ?? [] ],
      members: fields.map(field => this._getMember(field))
    });
  }

  /**
   * One graph member. A kind with no handler stays Invalid, which throws when used.
   * A declared type nothing registers (an interface) stays dynamic.
   * @param {object} field Schema declaration.
   * @returns {object} Graph member.
   */
  static _getMember(field)
  {
    const kind = field.type?.kind;
    const map = this._getMapType(field.type);
    if (map !== undefined) return this._getMapMember(field, map);

    const values = this._getValuesHandler(field.type);
    const edge = values ? null : KIND_EDGES[kind];
    const declared = edge ? DeclaredClassName(field.type) : null;

    return {
      name: field.name, key: field.key, index: field.index, field,
      handler: values ?? KIND_HANDLERS[kind],
      edge: edge ? {
        kind: edge,
        collection: kind === "list" || kind === "structList",
        type: declared && getRegisteredConstructor(declared) ? declared : null
      } : null
    };
  }

  /**
   * The declared class of a Map of objects, null for a dynamic one, or undefined when the
   * member is not one. A Map of anything else stays Invalid.
   * @param {object|undefined} type Schema type.
   * @returns {string|null|undefined} Class name.
   */
  static _getMapType(type)
  {
    if (type?.kind !== "map") return undefined;

    const value = type.valueType;
    const name = typeof value === "string" ? value : value?.kind === "rootRef" ? value.className : undefined;
    if (name === undefined || Object.hasOwn(KIND_HANDLERS, name)) return undefined;

    return getRegisteredConstructor(name) ? name : null;
  }

  /**
   * One Map member.
   * @param {object} field Schema declaration.
   * @param {string|null} type Declared class of its values.
   * @returns {object} Graph member.
   */
  static _getMapMember(field, type)
  {
    return {
      name: field.name, key: field.key, index: field.index, field,
      handler: MAP_HANDLER,
      edge: { kind: "ref", collection: true, map: true, type }
    };
  }

  /**
   * The shared handler for a list or array of plain values, or null for any other member.
   * @param {object|undefined} type Schema type.
   * @returns {object|null} The handler.
   */
  static _getValuesHandler(type)
  {
    if (type?.kind !== "list" && type?.kind !== "array") return null;

    const item = typeof type.itemType === "string" ? type.itemType : type.itemType?.kind;
    if (!Object.hasOwn(KIND_HANDLERS, item) || KIND_EDGES[item]) return null;

    return VALUE_HANDLERS[item] ??= new graph.CjsGraphTypeValues(KIND_HANDLERS[item]);
  }

  /** Stable class identity. */
  static className = "CjsBlueGraph";

}
