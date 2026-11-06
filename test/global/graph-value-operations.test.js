import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CjsGraph, CjsGraphRoot, CjsGraphTypeFloat32, CjsGraphTypeIRootPtr, CjsGraphTypeList, CjsGraphTypeString, CjsGraphTypeStruct,
  CjsGraphTypeVector3, GraphOperation
} from "../../src/global/model/graph/index.js";

const string = new CjsGraphTypeString();
const float = new CjsGraphTypeFloat32();
const vector = new CjsGraphTypeVector3();
const reference = new CjsGraphTypeIRootPtr();
const list = new CjsGraphTypeList();
const struct = new CjsGraphTypeStruct();

class Leaf
{
  name = "";
  weight = 1;
  position = new Float32Array(3);
}

class Special extends Leaf
{
  extra = 0;
}

class Row
{
  value = 0;
}

class Holder
{
  name = "";
  child = null;
  other = null;
  items = [];
  rows = [];
  slots = [ null, null ];
}

const leafMembers = [
  { name: "name", handler: string },
  { name: "weight", handler: float, flags: 1 },
  { name: "position", handler: vector }
];

CjsGraph.define(Leaf, { name: "GraphValueLeaf", members: leafMembers });
CjsGraph.define(Special, { name: "GraphValueSpecial", members: [ { name: "extra", handler: float } ] });
CjsGraph.define(Row, { name: "GraphValueRow", members: [ { name: "value", handler: float } ] });
CjsGraph.define(Holder, { name: "GraphValueHolder", members: [
  { name: "name", handler: string },
  { name: "child", handler: reference, edge: { kind: "ref", type: Leaf } },
  { name: "other", handler: reference, edge: { kind: "ref" } },
  { name: "items", handler: list, edge: { kind: "ref", collection: true, type: Leaf } },
  { name: "rows", handler: list, edge: { kind: "embed", collection: true, type: Row } },
  { name: "first", key: "slots", index: 0, handler: reference, edge: { kind: "ref", type: Leaf } },
  { name: "second", key: "slots", index: 1, handler: reference, edge: { kind: "ref", type: Leaf } }
] });

function leaf(name, weight = 1)
{
  const object = new Leaf();
  object.name = name;
  object.weight = weight;
  return object;
}

test("get writes declared members, independent arrays and null", () =>
{
  const holder = new Holder();
  holder.name = "h";
  holder.child = leaf("a", 2);
  holder.child.position.set([ 1, 2, 3 ]);
  holder.rows.push(new Row());

  const values = CjsGraph.get(holder);
  assert.deepEqual(values, {
    name: "h",
    child: { name: "a", weight: 2, position: [ 1, 2, 3 ] },
    other: null,
    items: [],
    rows: [ { value: 0 } ]
  });

  values.child.position[0] = 9;
  assert.equal(holder.child.position[0], 1);
});

test("get writes a shared object once, anchors it on second sight and closes a cycle", () =>
{
  class Node
  {
    next = null;
  }
  CjsGraph.define(Node, { name: "GraphValueNode", members: [ { name: "next", handler: reference, edge: { kind: "ref", type: Node } } ] });

  const shared = leaf("shared");
  const holder = new Holder();
  holder.child = shared;
  holder.items.push(shared, leaf("own"), null);

  const values = CjsGraph.get(holder);
  assert.equal(values.child._id, 1);
  assert.deepEqual(values.items[0], { _ref: 1 });
  assert.equal(values.items[1].name, "own");
  assert.equal(values.items[2], null);

  const flat = CjsGraph.get(holder, { refs: false });
  assert.equal(flat.child._id, undefined);
  assert.equal(flat.items[0].name, "shared");

  const node = new Node();
  node.next = node;
  assert.deepEqual(CjsGraph.get(node), { _id: 1, next: { _ref: 1 } });
});

test("get writes _type only where the class differs from the declared one, unless forced", () =>
{
  const holder = new Holder();
  holder.child = leaf("declared");
  holder.items.push(new Special());
  holder.other = new Row();

  const tagged = CjsGraph.get(holder, { typeTags: true });
  assert.equal(tagged._type, "GraphValueHolder");
  assert.equal(tagged.child._type, undefined);
  assert.equal(tagged.items[0]._type, "GraphValueSpecial");
  assert.equal(tagged.other._type, "GraphValueRow");

  const forced = CjsGraph.get(holder, { forceTypeTags: true });
  assert.equal(forced.child._type, "GraphValueLeaf");
  assert.equal(CjsGraph.get(holder).child._type, undefined);
});

test("get omits an empty indexed slot and reads a filled one", () =>
{
  const holder = new Holder();
  holder.slots[1] = leaf("slot");

  const values = CjsGraph.get(holder);
  assert.equal(Object.hasOwn(values, "first"), false);
  assert.equal(values.second.name, "slot");
  assert.equal(CjsGraph.getValue(holder, "second").name, "slot");
  assert.equal(CjsGraph.getValue(holder, "first"), null);
});

test("get asks the policy once per class, and the answer follows a registration change", () =>
{
  class Late
  {
    a = 1;
    b = 2;
  }
  CjsGraph.define(Late, { name: "GraphValueLate", members: [ { name: "a", handler: float }, { name: "b", handler: float } ] });

  const asked = [];
  const policy = {
    acceptMember(member, info, operation)
    {
      asked.push([ member.name, operation ]);
      return member.name !== "b";
    }
  };

  const late = new Late();
  assert.deepEqual(CjsGraph.get(late, { policy }), { a: 1 });
  assert.deepEqual(CjsGraph.get(late, { policy }), { a: 1 });
  assert.deepEqual(asked, [ [ "a", GraphOperation.GET ], [ "b", GraphOperation.GET ] ]);

  CjsGraph.define(Late, { name: "GraphValueLate", members: [ { name: "b", handler: float } ] });
  assert.deepEqual(CjsGraph.get(late), { b: 2 });
  assert.deepEqual(CjsGraph.get(late, { policy }), {});
  assert.throws(() => CjsGraph.getValue(late, "a"), /Unknown graph member/);
});

test("get resolves a policy-hidden derived declaration to the visible base declaration", () =>
{
  class Base
  {
    value = 1;
    hidden = 2;
  }
  class Derived extends Base {}
  CjsGraph.define(Base, { name: "GraphValueBase", members: [ { name: "value", handler: float } ] });
  CjsGraph.define(Derived, { name: "GraphValueDerived", members: [ { name: "value", key: "hidden", handler: float, secret: true } ] });

  assert.deepEqual(CjsGraph.get(new Derived()), { value: 2 });
  assert.deepEqual(CjsGraph.get(new Derived(), { policy: { acceptMember: member => !member.secret } }), { value: 1 });
});

test("get refuses an unregistered object rather than dropping it", () =>
{
  class Unknown {}
  const holder = new Holder();
  holder.other = new Unknown();
  assert.throws(() => CjsGraph.get(holder), /Unknown graph class/);
});

test("struct handler writes an embedded object", () =>
{
  class Embed
  {
    row = new Row();
  }
  CjsGraph.define(Embed, { name: "GraphValueEmbed", members: [ { name: "row", handler: struct, edge: { kind: "embed", type: Row } } ] });
  assert.deepEqual(CjsGraph.get(new Embed()), { row: { value: 0 } });
});

/** A policy that records each completion, for lifecycle order. */
function tracing()
{
  const trace = [];
  return {
    trace,
    acceptMember() { return true; },
    complete(object, info, changes, created) { trace.push([ info.declared.name, object.name ?? null, created, changes ]); }
  };
}

test("set skips equal members, records changed ones and returns false when nothing changed", () =>
{
  const object = leaf("a", 2);
  const position = object.position;

  assert.equal(CjsGraph.set(object, { name: "a", weight: 2, position: [ 0, 0, 0 ] }), false);
  assert.deepEqual(CjsGraph.set(object, { name: "b", position: [ 1, 2, 3 ] }), { name: "b", position: [ 1, 2, 3 ] });
  assert.equal(object.position, position, "typed storage keeps its identity");
  assert.equal(CjsGraph.set(object, { name: "b" }), false);
  assert.equal(CjsGraph.set(object, null), false);
  assert.equal(CjsGraph.set(object, {}), false);
});

test("set refuses what is not valid input, leaving the handler unasked", () =>
{
  const object = leaf("a");

  assert.throws(() => CjsGraph.set(object, { weight: "heavy" }), /Invalid value for graph member: GraphValueLeaf.weight/);
  assert.throws(() => CjsGraph.set(object, { position: [ 1, 2 ] }), /Invalid value/);
  assert.throws(() => CjsGraph.set(object, { name: 12 }), /Invalid value/);
  assert.throws(() => CjsGraph.set(new Holder(), { child: [] }), /Invalid value/);
  assert.throws(() => CjsGraph.set(new Holder(), { items: {} }), /Invalid value/);
  assert.equal(object.name, "a");

  assert.throws(() => CjsGraph.set(object, leaf("live")), /requires plain values/);
  assert.throws(() => CjsGraph.set(object, []), /requires plain values/);
  assert.throws(() => CjsGraph.set(object, { nothing: 1 }), /Unknown graph member/);

  assert.deepEqual(CjsGraph.set(object, { name: 12 }, { validate: false }), { name: "12" });
});

test("set skips a member the policy refuses, and writes a null past a leaf handler", () =>
{
  const policy = { acceptMember: member => member.name !== "name", complete() {} };
  const object = leaf("kept");

  assert.equal(CjsGraph.set(object, { name: "ignored" }, { policy }), false);
  assert.equal(object.name, "kept");

  assert.deepEqual(CjsGraph.set(object, { name: null }), { name: null });
  assert.equal(object.name, null);
  assert.equal(CjsGraph.set(object, { name: null }), false);
  assert.equal(CjsGraph.get(object).name, null);

  object.position = null;
  assert.equal(CjsGraph.get(object).position, null);
  assert.equal(CjsGraph.set(object, { position: null }), false);
});

test("set reads a bag into the held object, recording a nested bag", () =>
{
  const holder = new Holder();
  const child = holder.child = leaf("a");

  assert.deepEqual(CjsGraph.set(holder, { child: { name: "b" } }), { child: { name: "b" } });
  assert.equal(holder.child, child);
  assert.equal(child.name, "b");
  assert.equal(CjsGraph.set(holder, { child: { name: "b" } }), false);
});

test("set replaces a reference, recording the live object", () =>
{
  const holder = new Holder();
  const live = leaf("live");

  assert.deepEqual(CjsGraph.set(holder, { child: live }), { child: live });
  assert.equal(holder.child, live);
  assert.equal(CjsGraph.set(holder, { child: live }), false);

  const changes = CjsGraph.set(holder, { child: { _type: "GraphValueSpecial", extra: 4 } });
  assert.equal(holder.child.constructor, Special);
  assert.equal(changes.child, holder.child);

  assert.deepEqual(CjsGraph.set(holder, { child: null }), { child: null });
  assert.equal(holder.child, null);
  assert.equal(CjsGraph.set(holder, { child: null }), false);
});

test("set writes through an indexed slot", () =>
{
  const holder = new Holder();
  const slots = holder.slots;

  CjsGraph.set(holder, { second: { name: "slot" } });
  assert.equal(holder.slots, slots);
  assert.equal(holder.slots[1].name, "slot");
  assert.equal(holder.slots[0], null);
});

test("a plain array replaces a list in place: objects stay, bags are new, the rest removed", () =>
{
  const holder = new Holder();
  const items = holder.items;
  const stays = leaf("stays"), removed = leaf("removed");
  items.push(stays, removed);

  const changes = CjsGraph.set(holder, { items: [ { name: "new" }, stays ] });

  assert.equal(holder.items, items, "list storage keeps its identity");
  assert.equal(items.length, 2);
  assert.equal(items[0].name, "new");
  assert.equal(items[1], stays);
  assert.deepEqual(changes, { items: [ items[0], stays ] });
  assert.notEqual(changes.items, items, "the record does not alias the list");
});

test("a list that already matches is no change, including bags and live items", () =>
{
  const holder = new Holder();
  const first = leaf("a", 2);
  holder.items.push(first);

  assert.equal(CjsGraph.set(holder, { items: [ first ] }), false);
  assert.equal(CjsGraph.set(holder, { items: CjsGraph.get(holder).items }), false);
  assert.equal(CjsGraph.set(holder, { items: holder.items }), false);
  assert.equal(holder.items[0], first);

  // A bag has no identity, so a changed bag is a new object: never positional.
  CjsGraph.set(holder, { items: [ { name: "b" } ] });
  assert.notEqual(holder.items[0], first);
  assert.equal(holder.items[0].weight, 1);

  CjsGraph.set(holder, { items: null });
  assert.deepEqual(holder.items, []);
  assert.equal(CjsGraph.set(holder, { items: null }), false);
});

test("change detection is exact: a change inside Float32 tolerance is not dropped", () =>
{
  const holder = new Holder();
  holder.items.push(leaf("a", 1));

  const nudged = 1 + 1e-7;
  assert.equal(float.IsLike(1, nudged), true, "the tolerance the comparison must not use");
  assert.notEqual(CjsGraph.set(holder, { items: [ { weight: nudged } ] }), false);
  assert.notEqual(CjsGraph.set(leaf("b", 1), { weight: nudged }), false);
});

test("structure list rows reuse their position, and record what changed", () =>
{
  const holder = new Holder();
  const row = new Row();
  holder.rows.push(row);

  assert.equal(CjsGraph.set(holder, { rows: [ { value: 0 } ] }), false);

  const changes = CjsGraph.set(holder, { rows: [ { value: 5 }, { value: 6 } ] });
  assert.equal(holder.rows[0], row);
  assert.equal(row.value, 5);
  assert.equal(holder.rows[1].constructor, Row);
  assert.deepEqual(changes, { rows: [ row, holder.rows[1] ] });

  CjsGraph.set(holder, { rows: [ { value: 5 } ] });
  assert.equal(holder.rows.length, 1);
});

test("an embedded object keeps its identity, ignores null and copies a live object by value", () =>
{
  class Embed
  {
    row = new Row();
    empty = null;
  }
  CjsGraph.define(Embed, { name: "GraphValueEmbedSet", members: [
    { name: "row", handler: struct, edge: { kind: "embed", type: Row } },
    { name: "empty", handler: struct, edge: { kind: "embed", type: Row } }
  ] });

  const embed = new Embed(), row = embed.row;
  assert.deepEqual(CjsGraph.set(embed, { row: { value: 3 } }), { row: { value: 3 } });
  assert.equal(embed.row, row);
  assert.equal(CjsGraph.set(embed, { row: null }), false);
  assert.equal(embed.row, row);

  const live = new Row();
  live.value = 8;
  CjsGraph.set(embed, { row: live });
  assert.equal(embed.row, row);
  assert.equal(row.value, 8);

  CjsGraph.set(embed, { empty: { value: 1 } });
  assert.equal(embed.empty.constructor, Row);

  assert.throws(() => CjsGraph.set(embed, { row: { _type: "GraphValueLeaf" } }), /Expected GraphValueRow/);
});

test("from creates declared and tagged classes; an unknown class is an error", () =>
{
  const object = CjsGraph.from(Leaf, { name: "a", position: [ 1, 2, 3 ] });
  assert.equal(object.constructor, Leaf);
  assert.equal(object.position.constructor, Float32Array);

  assert.equal(CjsGraph.from("GraphValueLeaf", {}).constructor, Leaf);
  assert.equal(CjsGraph.from(null, { _type: "GraphValueSpecial" }).constructor, Special);
  assert.equal(CjsGraph.from(Leaf, { _type: "GraphValueSpecial" }).constructor, Special);
  assert.equal(CjsGraph.from(Leaf, null).constructor, Leaf);

  assert.throws(() => CjsGraph.from(null, {}), /names no class/);
  assert.throws(() => CjsGraph.from(null, { _type: "GraphValueNothing" }), /Unknown graph class: GraphValueNothing/);
  assert.throws(() => CjsGraph.from(Leaf, { _type: "GraphValueRow" }), /not assignable/);
  assert.throws(() => CjsGraph.from(Holder, { items: [ { _type: "GraphValueNothing" } ] }), /Unknown graph class/);
});

test("shared references, cycles and forward references rebuild the same topology", () =>
{
  class Node
  {
    name = "";
    next = null;
    friend = null;
  }
  CjsGraph.define(Node, { name: "GraphValueSetNode", members: [
    { name: "name", handler: string },
    { name: "next", handler: reference, edge: { kind: "ref", type: Node } },
    { name: "friend", handler: reference, edge: { kind: "ref", type: Node } }
  ] });

  const ring = CjsGraph.from(Node, { _id: 1, name: "a", next: { name: "b", next: { _ref: 1 } } });
  assert.equal(ring.next.next, ring);

  const forward = CjsGraph.from(Node, { name: "a", next: { _ref: 2 }, friend: { _id: 2, name: "b" } });
  assert.equal(forward.next, forward.friend);
  assert.equal(forward.next.name, "b");

  const shared = leaf("shared");
  const holder = new Holder();
  holder.child = shared;
  holder.items.push(shared, leaf("own"));
  const built = CjsGraph.from(Holder, CjsGraph.get(holder));
  assert.equal(built.items[0], built.child);
  assert.notEqual(built.items[1], built.child);

  const list = CjsGraph.from(Holder, { items: [ { _ref: 3 }, { name: "x" } ], child: { _id: 3, name: "later" } });
  assert.equal(list.items[0], list.child);

  assert.throws(() => CjsGraph.from(Node, { next: { _ref: 9 } }), /Unresolved _ref: 9/);
  assert.throws(() => CjsGraph.from(Holder, { child: { _ref: 1 }, other: { _id: 1, _type: "GraphValueRow" } }), /not assignable/);
});

test("a forward reference is in the change record, nested through its parents", () =>
{
  const holder = new Holder();
  holder.items.push(leaf("old"));

  const changes = CjsGraph.set(holder, {
    child: { _ref: 5 },
    items: [ { _ref: 5 } ],
    other: { _id: 5, _type: "GraphValueLeaf", name: "target" }
  });

  assert.equal(holder.child, holder.other);
  assert.equal(holder.items[0], holder.other);
  assert.equal(changes.child, holder.other);
  assert.equal(changes.items[0], holder.other);
  assert.equal(changes.other, holder.other);
});

test("completion runs after references resolve, children first, created once, borrowed not created", () =>
{
  const policy = tracing();
  const borrowed = leaf("borrowed");
  const holder = new Holder();
  holder.name = "holder";
  holder.child = borrowed;

  CjsGraph.set(holder, { child: { name: "changed" }, items: [ { name: "made" } ], other: { _ref: 7 }, first: { _id: 7, name: "slot" } }, { policy });

  assert.deepEqual(policy.trace.map(([ type, name, created ]) => [ type, name, created ]), [
    [ "GraphValueLeaf", "changed", false ],
    [ "GraphValueLeaf", "made", true ],
    [ "GraphValueLeaf", "slot", true ],
    [ "GraphValueHolder", "holder", false ]
  ]);

  // The parent's record already holds the resolved forward reference when it completes.
  assert.equal(policy.trace[3][3].other, holder.other);
  assert.equal(holder.other, holder.slots[0]);

  policy.trace.length = 0;
  assert.equal(CjsGraph.set(holder, { name: "holder" }, { policy }), false);
  assert.deepEqual(policy.trace, [], "an unchanged object is not told");
});

test("a cycle completes each object once, and nothing completes on failure", () =>
{
  const policy = tracing();

  CjsGraph.from(Holder, { _id: 1, name: "a", other: { _type: "GraphValueHolder", name: "b", other: { _ref: 1 } } }, { policy });
  assert.deepEqual(policy.trace.map(([ , name, created ]) => [ name, created ]), [ [ "b", true ], [ "a", true ] ]);

  policy.trace.length = 0;
  assert.throws(() => CjsGraph.from(Holder, { child: { name: "x" }, other: { _ref: 8 } }, { policy }), /Unresolved/);
  assert.deepEqual(policy.trace, []);
});

test("a default child read under a created owner counts as created", () =>
{
  class Parent
  {
    name = "";
    child = new Leaf();
  }
  CjsGraph.define(Parent, { name: "GraphValueParent", members: [
    { name: "name", handler: string },
    { name: "child", handler: reference, edge: { kind: "ref", type: Leaf } }
  ] });

  const policy = tracing();
  CjsGraph.from(Parent, { child: { name: "x" } }, { policy });
  assert.deepEqual(policy.trace.map(([ , , created ]) => created), [ true, true ]);
});

test("a registered library names _type: the last registered wins, and Create makes the instance", () =>
{
  class First {}
  class Second {}
  CjsGraph.define(First, { name: "GraphValueLibraryFirst", members: [] });
  CjsGraph.define(Second, { name: "GraphValueLibrarySecond", members: [] });

  const made = [];
  const library = classes => ({
    Get(typeName) { return classes[typeName]; },
    Create(typeName) { made.push(typeName); return new classes[typeName](); }
  });

  CjsGraph.registerLibrary(library({ GraphValueLibraryName: First }));
  assert.equal(CjsGraph.from(null, { _type: "GraphValueLibraryName" }).constructor, First);

  CjsGraph.registerLibrary(library({ GraphValueLibraryName: Second }));
  assert.equal(CjsGraph.from(null, { _type: "GraphValueLibraryName" }).constructor, Second);
  assert.deepEqual(made, [ "GraphValueLibraryName", "GraphValueLibraryName" ]);

  // An older library still answers for the names newer ones do not define.
  assert.equal(CjsGraph.from(null, { _type: "GraphValueLeaf" }).constructor, Leaf);
  assert.equal(CjsGraph.isType(new Second(), "GraphValueLibraryName"), true);
  assert.equal(CjsGraph.isType(new First(), "GraphValueLibraryName"), false);
});

test("values mode leaves _type as data and needs no class", () =>
{
  const values = { _type: "NoSuchClass", _id: 1, list: [ { _ref: 1 }, null ], data: new Float32Array([ 1 ]) };
  const plain = CjsGraph.from(null, values, { valuesMode: true });

  assert.deepEqual(plain, { _type: "NoSuchClass", _id: 1, list: [ { _ref: 1 }, null ], data: [ 1 ] });
  assert.notEqual(plain.list, values.list);
  assert.throws(() => CjsGraph.from(null, { live: leaf("x") }, { valuesMode: true }), /values mode/);
});

test("clone rebuilds a separate graph, and copy writes into a target, keeping identity", () =>
{
  const shared = leaf("shared", 3);
  shared.position.set([ 1, 2, 3 ]);
  const holder = new Holder();
  holder.name = "h";
  holder.child = shared;
  holder.other = new Special();
  holder.items.push(shared);
  holder.rows.push(new Row());

  const clone = CjsGraph.clone(holder);
  assert.equal(clone.constructor, Holder);
  assert.deepEqual(CjsGraph.get(clone), CjsGraph.get(holder));
  assert.notEqual(clone.child, shared);
  assert.equal(clone.items[0], clone.child, "sharing inside the graph is kept");
  assert.equal(clone.other.constructor, Special);
  assert.notEqual(clone.child.position, shared.position);

  const target = new Holder();
  const items = target.items;
  const changes = CjsGraph.copy(holder, target);
  assert.notEqual(changes, false);
  assert.equal(target.items, items);
  assert.equal(target.name, "h");
  assert.notEqual(target.child, shared);
  assert.equal(target.items[0], target.child);
});

test("CjsGraphRoot forwards every operation and holds per-object state", () =>
{
  class Rooted extends CjsGraphRoot
  {
    name = "";
    weight = 1;
  }
  CjsGraph.define(Rooted, { name: "GraphValueRooted", members: [ { name: "name", handler: string }, { name: "weight", handler: float } ] });

  const object = Rooted.from({ name: "a" });
  assert.equal(object.constructor, Rooted);
  assert.equal(object.__cjs.destructed, false);
  assert.deepEqual(object.GetValues(), { name: "a", weight: 1 });
  assert.equal(object.GetValue("name"), "a");
  assert.deepEqual(object.SetValues({ weight: 2 }), { weight: 2 });
  assert.deepEqual(object.SetValue("name", "b"), { name: "b" });
  assert.equal(object.SetValue("name", "b"), false);

  const clone = object.Clone();
  assert.notEqual(clone, object);
  assert.notEqual(clone.__cjs, object.__cjs);
  assert.deepEqual(clone.GetValues(), object.GetValues());

  const target = new Rooted();
  assert.deepEqual(target.Copy(object), { name: "b", weight: 2 });
});

test("a nested operation inside completion runs on its own state", () =>
{
  const inner = leaf("inner");
  const policy = {
    acceptMember() { return true; },
    complete(object) { if (object !== inner) CjsGraph.set(inner, { name: "touched" }); }
  };

  const holder = new Holder();
  CjsGraph.set(holder, { name: "x" }, { policy });
  assert.equal(inner.name, "touched");
});
