import { EDITFLAGS } from "../../src/global/consts/blue.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import { CjsGraph } from "../../src/global/model/graph/index.js";


test("declared traversal preserves DFS order, shares and cycles without reading undeclared values", () =>
{
  class Node { child = null; links = []; observer = null; }
  CjsGraph.define(Node, { name: "WalkNode", members: [
    { name: "child", type: "rootRef", edge: { kind: "embed" } },
    { name: "links", type: "rootRef", edge: { kind: "ref", collection: true } },
    { name: "observer", type: "rootRef", edge: { kind: "weak" } },
    { name: "leaf", type: "float32" }
  ] });
  const root = new Node(), child = new Node(), shared = new Node(), weak = new Node();
  Object.assign(root, { child, links: [shared, child, null], observer: weak });
  Object.assign(child, { child: null, links: [shared, root] });
  Object.assign(shared, { links: [] });
  Object.assign(weak, { links: [] });
  Object.defineProperty(root, "undeclared", { get() { throw new Error("must not scan"); } });
  Object.defineProperty(root, "leaf", { get() { throw new Error("must not read leaves"); } });
  root.constructor = "an authored property";
  Object.seal(root);

  const visited = [];
  assert.equal(CjsGraph.traverse(root, object => { visited.push(object); }), 3);
  assert.deepEqual(visited, [root, child, shared]);
  assert.equal(Object.hasOwn(root, "__cjs"), false);
  visited.length = 0;
  CjsGraph.traverse(root, object => { visited.push(object); }, { edges: ["embed", "ref", "weak"] });
  assert.deepEqual(visited, [root, child, shared, weak]);
});

test("filtering precedes inherited name and edge selection without grouping order changes", () =>
{
  class Base {}
  class Derived extends Base {}
  class Leaf {}
  CjsGraph.define(Leaf, { name: "WalkLeaf" });
  CjsGraph.define(Base, { name: "WalkBase", members: [
    { name: "x", key: "baseX", type: "rootRef", edge: { kind: "embed" } },
    { name: "shadow", key: "baseShadow", type: "rootRef", edge: { kind: "embed" } }
  ] });
  CjsGraph.define(Derived, { name: "WalkDerived", members: [
    { name: "x", key: "hiddenX", type: "rootRef", flags: EDITFLAGS.HIDDEN, edge: { kind: "embed" } },
    { name: "y", type: "rootRef", edge: { kind: "embed" } },
    { name: "shadow", type: "float32" }
  ] });
  const root = new Derived();
  root.y = new Leaf();
  root.baseX = new Leaf();
  Object.defineProperty(root, "hiddenX", { get() { throw new Error("hidden"); } });
  Object.defineProperty(root, "baseShadow", { get() { throw new Error("shadowed by leaf"); } });
  const visited = [];
  CjsGraph.traverse(root, object => { visited.push(object); }, { acceptMember: member => (member.flags & EDITFLAGS.HIDDEN) === 0 });
  assert.deepEqual(visited, [root, root.y, root.baseX]);
});

test("explicit struct type, indexed storage and dynamic derived classes resolve declared edges", () =>
{
  class Container {}
  class Struct {}
  class Base {}
  class Derived extends Base {}
  CjsGraph.define(Container, { name: "WalkContainer", members: [
    { name: "part", key: "slots", index: 1, type: "rootRef", edge: { kind: "embed", type: "WalkStruct" } }
  ] });
  CjsGraph.define(Struct, { name: "WalkStruct", members: [
    { name: "child", type: "rootRef", edge: { kind: "ref", type: Base } }
  ] });
  CjsGraph.define(Base, { name: "WalkTypedBase" });
  CjsGraph.define(Derived, { name: "WalkTypedDerived" });
  const child = new Derived(), struct = { child }, root = new Container();
  root.slots = [42, struct];
  const classes = [];
  CjsGraph.traverse(root, (object, info) => { classes.push(info.declared.name); });
  assert.deepEqual(classes, ["WalkContainer", "WalkStruct", "WalkTypedDerived"]);
});

test("nested walks revisit finished outer nodes without overwriting outer pass marks", () =>
{
  class Node { child = null; children = []; }
  CjsGraph.define(Node, { name: "WalkNested", members: [
    { name: "children", type: "rootRef", edge: { kind: "ref", collection: true } }
  ] });
  const root = new Node(), a = new Node(), b = new Node();
  root.children = [a, b, a];
  a.children = [];
  b.children = [root, a];
  const outer = [], inner = [];
  CjsGraph.traverse(root, object =>
  {
    outer.push(object);
    if (object === b) CjsGraph.traverse(root, nested => { inner.push(nested); });
  });
  assert.deepEqual(outer, [root, a, b]);
  assert.deepEqual(inner, [root, a, b]);
  assert.equal(CjsGraph._traversalDepth, 0);
});

test("failure and pruning release reusable state and subsequent calls remain independent", () =>
{
  class Node { child = null; children = []; }
  CjsGraph.define(Node, { name: "WalkFailure", members: [
    { name: "child", type: "rootRef", edge: { kind: "ref" } }
  ] });
  const root = new Node();
  root.child = new Node();
  const failure = new Error("visitor failure");
  assert.throws(() => CjsGraph.traverse(root, object =>
  {
    if (object === root.child) throw failure;
  }), error => error === failure);
  assert.equal(CjsGraph.traverse(root, () => false), 1);
  assert.equal(CjsGraph.traverse(root, () => {}), 2);
  assert.equal(CjsGraph._traversalDepth, 0);
  for (const state of CjsGraph._traversals)
  {
    assert.equal(state.classes.size, 0);
    for (const frame of state.frames)
    {
      assert.equal(frame.object, null);
      assert.equal(frame.items, null);
      assert.equal(frame.members, null);
      assert.equal(frame.type, null);
    }
  }
});

test("unknown dynamic classes fail instead of silently hiding their descendants", () =>
{
  class Root {}
  class Later {}
  CjsGraph.define(Root, { name: "WalkUnknownRoot", members: [
    { name: "child", type: "rootRef", edge: { kind: "ref" } }
  ] });
  const root = new Root();
  root.child = new Later();
  assert.throws(() => CjsGraph.traverse(root, () => {}), /Unknown graph class/);
  CjsGraph.define(Later, { name: "WalkLater" });
  assert.equal(CjsGraph.traverse(root, () => {}), 2);
  root.child = 5;
  assert.throws(() => CjsGraph.traverse(root, () => {}), /requires an object/);
});

test("traversal is iterative for a deep chain and reuses the same frames on a warm call", () =>
{
  class Node { child = null; children = []; }
  CjsGraph.define(Node, { name: "WalkDeep", members: [
    { name: "child", type: "rootRef", edge: { kind: "embed" } }
  ] });
  const root = new Node();
  let node = root;
  for (let i = 1; i < 20000; i++) node = node.child = new Node();
  assert.equal(CjsGraph.traverse(root, () => {}), 20000);
  const state = CjsGraph._traversals[0], frames = state.frames.slice();
  assert.equal(CjsGraph.traverse(root, () => {}), 20000);
  assert.equal(state.frames.length, frames.length);
  for (let i = 0; i < frames.length; i++) assert.equal(state.frames[i], frames[i]);
});

test("edge declarations are snapshotted and invalid definitions do not replace valid ones", () =>
{
  class Node { child = null; children = []; }
  const edge = { kind: "embed", collection: true };
  const info = CjsGraph.define(Node, { name: "WalkEdgeValidation", members: [{ name: "children", type: "rootRef", edge }] });
  edge.kind = "weak";
  assert.equal(info.declared.members[0].edgeKind, "embed");
  assert.throws(() => CjsGraph.define(Node, { name: "WalkEdgeValidation", members: [
    { name: "children", type: "rootRef", edge: { kind: "unknown" } }
  ] }), /ownership/);
  assert.equal(info.declared.members[0].edgeKind, "embed");
});

test("a failed nested visitor can be caught without changing the outer walk", () =>
{
  class Node { child = null; children = []; }
  CjsGraph.define(Node, { name: "WalkNestedFailure", members: [
    { name: "child", type: "rootRef", edge: { kind: "embed" } }
  ] });
  const root = new Node();
  root.child = new Node();
  const visited = [];
  CjsGraph.traverse(root, object =>
  {
    visited.push(object);
    if (object === root) assert.throws(() => CjsGraph.traverse(root, () => { throw new Error("nested"); }), /nested/);
  });
  assert.deepEqual(visited, [root, root.child]);
  assert.equal(CjsGraph._traversalDepth, 0);
});

test("registration from a visitor fails before reading edges, then the new definition is usable", () =>
{
  class Node { child = null; children = []; }
  CjsGraph.define(Node, { name: "WalkMutation", members: [
    { name: "child", type: "rootRef", edge: { kind: "embed" } }
  ] });
  const root = new Node();
  Object.defineProperty(root, "child", { get() { throw new Error("stale edge read"); } });
  assert.throws(() => CjsGraph.traverse(root, () =>
  {
    CjsGraph.define(Node, { name: "WalkMutation" });
  }), /declarations changed/);
  assert.equal(CjsGraph.traverse(root, () => {}), 1);
});

test("getter errors clear state, and eligibility is selected once per encountered class", () =>
{
  class Node { child = null; children = []; }
  CjsGraph.define(Node, { name: "WalkAccess", members: [
    { name: "children", type: "rootRef", edge: { kind: "ref", collection: true } }
  ] });
  const root = new Node(), child = new Node();
  root.children = [child];
  Object.defineProperty(child, "children", { configurable: true, get() { throw new Error("read failed"); } });
  assert.throws(() => CjsGraph.traverse(root, () => {}), /read failed/);
  assert.equal(CjsGraph._traversals[0].frames[0].object, null);
  assert.equal(CjsGraph._traversals[0].frames[1].object, null);
  Object.defineProperty(child, "children", { value: [], configurable: true });

  let selections = 0;
  const options = { acceptMember() { selections++; return true; } };
  assert.equal(CjsGraph.traverse(root, () => {}, options), 2);
  assert.equal(selections, 1);
});

test("missing edges, sparse collections and invalid indexed storage fail instead of hiding data", () =>
{
  class Node { child = null; }
  CjsGraph.define(Node, { name: "WalkMissing", members: [
    { name: "child", type: "rootRef", edge: { kind: "ref" } }
  ] });
  const root = new Node();
  delete root.child;
  assert.throws(() => CjsGraph.traverse(root, () => {}), /edge is undefined/);

  CjsGraph.define(Node, { name: "WalkMissing", members: [
    { name: "child", type: "rootRef", edge: { kind: "ref", collection: true } }
  ] });
  root.child = Array(1);
  assert.throws(() => CjsGraph.traverse(root, () => {}), /requires an object/);

  const indexed = { name: "child", type: "rootRef", index: 1, edge: { kind: "ref" } };
  CjsGraph.define(Node, { name: "WalkMissing", members: [indexed] });
  root.child = [null];
  assert.throws(() => CjsGraph.traverse(root, () => {}), /outside its storage/);
  root.child = { 1: null };
  assert.throws(() => CjsGraph.traverse(root, () => {}), /outside its storage/);
  assert.throws(() => CjsGraph.define(Node, { name: "WalkMissing", members: [
    { ...indexed, index: -1 }
  ] }), /non-negative integer/);
  root.child = [null, null];
  assert.equal(CjsGraph.traverse(root, () => {}), 1);
});
