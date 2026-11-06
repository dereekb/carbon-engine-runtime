import assert from "node:assert/strict";
import { test } from "node:test";
import { BLUELISTEVENT } from "../../npm/dist/global/consts/blue.js";
import { blue } from "../../npm/dist/blue/index.js";
import { CjsSchema } from "../../npm/dist/blue/schema/index.js";
import { CjsBlueGraph, CjsBlueGraphPolicy } from "../../npm/dist/blue/formats/graph/index.js";
import { CjsGraph } from "../../npm/dist/global/model/graph/index.js";
import { ImportAllDistModules } from "../support/allDistClasses.js";

await ImportAllDistModules();
CjsBlueGraph.register(blue.classes);

const create = name => new (blue.classes.Get(name))();
const policy = new CjsBlueGraphPolicy();
const quiet = { notify: false, markDirty: false, reuseObjects: true };

/** Records what an instance is told, without running its hooks. */
function spy(object)
{
  const told = [];
  object.OnModified = name => { told.push([ "OnModified", name ]); return true; };
  object.Initialize = () => { told.push([ "Initialize" ]); return true; };
  object.OnListModified = (event, key, key2, value) =>
  {
    told.push([ "OnListModified", event & BLUELISTEVENT.BELIST_EVENTMASK, key, value?.name ?? null ]);
    return true;
  };
  return told;
}

/** Runs one operation with the class's own hooks recorded for every instance it creates. */
function withPrototypeSpy(ctor, names, run)
{
  const told = [], saved = {};
  for (const name of names)
  {
    saved[name] = Object.getOwnPropertyDescriptor(ctor.prototype, name);
    ctor.prototype[name] = function(...args) { told.push([ name, this.name ?? null, ...args.slice(0, 1) ]); return true; };
  }

  try { run(); }
  finally
  {
    for (const name of names)
    {
      if (saved[name]) Object.defineProperty(ctor.prototype, name, saved[name]);
      else delete ctor.prototype[name];
    }
  }

  return told;
}

test("blue.classes Get and Create are thin wrappers over its real methods", () =>
{
  const name = "Tr2MeshArea";
  assert.equal(blue.classes.Get(name), blue.classes.GetClassRegistration(name).type);
  assert.equal(blue.classes.Create(name).constructor, blue.classes.Get(name));
  assert.equal(blue.classes.Get("NoSuchGraphClass"), null);
  assert.equal(blue.classes.Create("NoSuchGraphClass"), null);
});

test("_type names resolve through Blue's class library, and an unknown name is an error", () =>
{
  const area = CjsGraph.from(null, { _type: "Tr2MeshArea", name: "a" }, { policy });
  assert.equal(area.constructor, blue.classes.Get("Tr2MeshArea"));
  assert.equal(area.name, "a");
  assert.throws(() => CjsGraph.from(null, { _type: "NoSuchGraphClass" }, { policy }), /Unknown graph class/);
});

test("a mapped interface counts as assignable, and a legacy material sits in an effect member", () =>
{
  const area = create("Tr2MeshArea");
  area.effect = create("Tr2ShaderMaterial");
  assert.equal(CjsGraph.get(area, { policy: new CjsBlueGraphPolicy({ persistOnly: true }), typeTags: true }).effect._type, "Tr2ShaderMaterial");
});

test("a Map of objects reads and writes as a bag keyed by name", () =>
{
  const persisted = new CjsBlueGraphPolicy({ persistOnly: true, notify: false });
  const material = create("Tr2ShaderMaterial");
  const parameter = create("Tr2FloatParameter");
  parameter.name = "x";
  material.parameters.set("x", parameter);

  const values = CjsGraph.get(material, { policy: persisted, typeTags: true });
  assert.deepEqual(values, CjsSchema.getValues(material, {}, { persistOnly: true, typeTags: true }));

  const built = CjsGraph.from(null, values, { policy: persisted });
  assert.equal(built.parameters.get("x").constructor, parameter.constructor);
  assert.equal(CjsGraph.set(built, values, { policy: persisted }), false);
  assert.deepEqual(CjsGraph.traverse(material, () => {}), 2);
});

test("the policy picks members as the values path does", () =>
{
  const area = create("Tr2MeshArea");
  area.name = "a";

  const persisted = new CjsBlueGraphPolicy({ persistOnly: true });
  assert.deepEqual(CjsGraph.get(area, { policy: persisted }), CjsSchema.getValues(area, {}, { persistOnly: true }));
});

test("a member the class's own declaration dropped stays dropped, though a JS base declares it", () =>
{
  const light = create("EveSOFDataHullLightSetTexturedPointLight");
  const values = CjsGraph.get(light, { policy: new CjsBlueGraphPolicy({ persistOnly: true }) });
  assert.deepEqual(values, CjsSchema.getValues(light, {}, { persistOnly: true }));
  assert.equal(Object.hasOwn(values, "lightColor"), false);
});

test("an existing object is told OnModified once per changed NOTIFY member, in order", () =>
{
  const transition = create("Tr2StateMachineTransition");
  const told = spy(transition);

  CjsGraph.set(transition, { condition: "1", name: "first" }, { policy });
  assert.deepEqual(told, [ [ "OnModified", "condition" ], [ "OnModified", "name" ] ]);

  told.length = 0;
  assert.equal(CjsGraph.set(transition, { condition: "1", name: "first" }, { policy }), false);
  assert.deepEqual(told, [], "an equal member is not told");

  CjsGraph.set(transition, { name: "second" }, { policy });
  assert.deepEqual(told, [ [ "OnModified", "name" ] ], "one change, one call");
});

test("an existing IInitialize object is told OnModified and never initialised", () =>
{
  const parameter = create("TriFloatArrayParameter");
  const told = spy(parameter);

  CjsGraph.set(parameter, { name: "x" }, { policy });
  assert.deepEqual(told, [ [ "OnModified", "name" ] ]);
});

test("a created IInitialize object is initialised once and not told of its members", () =>
{
  const ctor = blue.classes.Get("Tr2FloatParameter");
  const told = withPrototypeSpy(ctor, [ "Initialize", "OnModified" ], () =>
  {
    CjsGraph.from(ctor, { name: "x" }, { policy });
  });

  assert.deepEqual(told, [ [ "Initialize", "x" ] ]);
});

test("UpdateValues tells the same OnModified as Set, through the policy", () =>
{
  const transition = create("Tr2StateMachineTransition");
  const told = spy(transition);

  transition.name = "direct";
  CjsGraph.updateValues(transition, "name", { policy });
  assert.deepEqual(told, [ [ "OnModified", "name" ] ]);
});

test("notify false tells nothing and still writes lists", () =>
{
  const silent = new CjsBlueGraphPolicy({ notify: false });
  const mesh = create("Tr2Mesh");
  const told = spy(mesh);
  const list = mesh.opaqueAreas;

  CjsGraph.set(mesh, { name: "x", opaqueAreas: [ { _type: "Tr2MeshArea", name: "a" } ] }, { policy: silent });
  assert.deepEqual(told, []);
  assert.equal(mesh.opaqueAreas, list);
  assert.equal(list.length, 1);
});

test("a mapped list sends the same events as DictReader, with the old items present at UNLOADSTART", () =>
{
  const run = write =>
  {
    const mesh = create("Tr2Mesh");
    const list = mesh.opaqueAreas;
    const first = create("Tr2MeshArea");
    first.name = "old";
    list.Append(first);

    const events = [];
    mesh.OnListModified = (event, key, key2, value, target) =>
    {
      events.push([ event & BLUELISTEVENT.BELIST_EVENTMASK, target.length ]);
      return true;
    };
    list.SetNotify(mesh);

    write(mesh);
    return { events, identity: mesh.opaqueAreas === list, names: Array.from(list, area => area.name) };
  };

  const values = { opaqueAreas: [ { _type: "Tr2MeshArea", name: "a" }, { _type: "Tr2MeshArea", name: "b" } ] };
  const graph = run(mesh => CjsGraph.set(mesh, values, { policy }));
  const old = run(mesh => CjsSchema.setValues(mesh, values, quiet));

  assert.deepEqual(graph, old);
  assert.deepEqual(graph.events, [ [ BLUELISTEVENT.BELIST_UNLOADSTART, 1 ], [ BLUELISTEVENT.BELIST_LOADFINISHED, 2 ] ]);
  assert.equal(graph.identity, true);
  assert.deepEqual(graph.names, [ "a", "b" ]);
});

test("a created owner fills its list raw, with no list events", () =>
{
  const ctor = blue.classes.Get("Tr2Mesh");
  const told = withPrototypeSpy(ctor, [ "OnListModified" ], () =>
  {
    CjsGraph.from(ctor, { opaqueAreas: [ { _type: "Tr2MeshArea", name: "a" } ] }, { policy: new CjsBlueGraphPolicy({ notify: false }) });
  });

  assert.deepEqual(told, []);
});
