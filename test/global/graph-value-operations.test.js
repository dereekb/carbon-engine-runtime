import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CjsGraph, CjsGraphTypeFloat32, CjsGraphTypeIRootPtr, CjsGraphTypeList, CjsGraphTypeString, CjsGraphTypeStruct,
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
