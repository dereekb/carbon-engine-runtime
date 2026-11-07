// Blue's side of the independent graph (global/model/graph), which imports nothing of Blue.
// Blue supplies its classes, as definitions with their flags as data, and as a class library.
// Disconnected: DictReader and DictWriter stay the live path until the one reviewed cutover.
import * as graph from "../../../global/model/graph/index.js";
import { CjsSchema } from "#schema";
import { mappedInterfaces } from "../../compose/interface.js";
import { isWritableField } from "../../compose/values.js";
import { IInitialize } from "../../exposure/IInitialize.js";
import { IListNotify } from "../../exposure/IListNotify.js";
import { INotify } from "../../exposure/INotify.js";
import { getClassRegistrations, getRegisteredConstructor } from "../../exposure/classes/registry.js";
import { IRootReaderBase } from "../../format/IRootReaderBase.js";
import { DeclaredClassName } from "../../format/IRootWriter.js";

const { CjsGraph } = graph;

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

/** How each object kind holds its object. `type.object.ref.weak` is a rootRef on the edge `refWeak`. */
const KIND_EDGES = { rootRef: "ref", rootWeak: "weak", root: "embed", rawStruct: "embed", list: "ref", structList: "embed" };

/**
 * Registers Blue's classes with the graph, from the same declarations the values path reads.
 * @cjs Our adapter: the graph may not import the schema.
 */
export class CjsBlueGraph
{

  /**
   * Defines every registered class that has no definition yet, and adds Blue's class library.
   * @param {object} classes The class library, normally blue.classes.
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
    const mapped = mappedInterfaces(ctor);

    return CjsGraph.define(ctor, {
      name,
      whole: true,
      initialize: mapped.has(IInitialize),
      notify: mapped.has(INotify),
      listNotify: mapped.has(IListNotify),
      interfaces: [ ...Array.from(mapped, item => CjsSchema.getClassName(item)), ...HELD_AS[name] ?? [] ],
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
    const edge = values ? null : field.type?.owned === false ? "refWeak" : KIND_EDGES[kind];
    const declared = edge ? DeclaredClassName(field.type) : null;

    return {
      ...this._getFlags(field),
      handler: values ?? KIND_HANDLERS[kind],
      edge: edge ? {
        kind: edge,
        collection: kind === "list" || kind === "structList",
        type: declared && getRegisteredConstructor(declared) ? declared : null
      } : null
    };
  }

  /**
   * A member's identity and Carbon's flags, as data. A values bag carries no binary block, and a
   * runtime-only member claims its name unread.
   * @param {object} field Schema declaration.
   * @returns {object} Member fields.
   */
  static _getFlags(field)
  {
    return {
      name: field.name, key: field.key, index: field.index,
      persist: field.edit?.persist === true || field.edit?.persistOnly === true,
      writable: isWritableField(field),
      notify: field.edit?.notify === true,
      hidden: field.type?.binary === true || field.type?.runtimeOnly === true
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
      ...this._getFlags(field),
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
