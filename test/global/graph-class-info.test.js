import assert from "node:assert/strict";
import { test } from "node:test";
import { CjsGraph, CjsGraphClassInfo, CjsGraphTypeFloat32, VARTYPE } from "../../src/global/model/graph/index.js";
import { VarEntry } from "../../src/blue/exposure/VarEntry.js";

const handler = new CjsGraphTypeFloat32();

test("source declarations and compiled members share one stable class record", () =>
{
  let constructions = 0, reads = 0;
  class Example
  {
    constructor() { constructions++; }
    get value() { reads++; return 3; }
  }
  const options = { length: 3 };
  const declaration = { name: "GraphInfoExample", members: [
    { name: "value", key: "storedValue", handler, options, flags: 7 }
  ] };
  const info = CjsGraph.define(Example, declaration);
  assert.equal(info.constructor, CjsGraphClassInfo);
  assert.equal(info.compiled, null);
  assert.equal(info.declared.members[0].key, "storedValue");

  options.length = 8;
  declaration.members[0].key = "changedExternally";
  const resolved = CjsGraph.getClassInfo("GraphInfoExample");
  assert.equal(resolved, info);
  assert.equal(resolved.compiled.byName.value[0].key, "storedValue");
  assert.equal(resolved.compiled.byName.value[0].options.length, 3);
  assert.equal(resolved.compiled.byName.value[0].handler, handler);
  assert.equal(CjsGraph.getClassInfo(Example).compiled, resolved.compiled);
  assert.equal(constructions, 0);
  assert.equal(reads, 0);
});

test("compilation preserves derived precedence and authored member order", () =>
{
  class Base {}
  class Middle extends Base {}
  class Derived extends Middle {}
  CjsGraph.define(Base, { name: "GraphOrderBase", members: [
    { name: "shared", key: "baseValue", handler }, { name: "baseOnly", handler }
  ] });
  const info = CjsGraph.define(Derived, { name: "GraphOrderDerived", members: [
    { name: "own", handler }, { name: "shared", key: "derivedValue", handler }
  ] });
  const compiled = CjsGraph.getClassInfo(Derived).compiled;
  assert.deepEqual(compiled.members.map(member => member.name), ["own", "shared", "shared", "baseOnly"]);
  assert.equal(compiled.byName.shared[0].key, "derivedValue");
  assert.equal(compiled.byName.shared[0].owner, info);
  assert.equal(compiled.parent, CjsGraph.getClassInfo(Base));
  assert.equal(info.declared.members.length, 2);
});

test("late parent registration and replacement invalidate derived descriptions", () =>
{
  class Parent {}
  class Child extends Parent {}
  const info = CjsGraph.define(Child, { name: "GraphLateChild", members: [{ name: "child", handler }] });
  const first = CjsGraph.getClassInfo(Child).compiled;
  CjsGraph.define(Parent, { name: "GraphLateParent", members: [{ name: "parent", handler }] });
  assert.equal(info.compiled, first); // Lazy invalidation retains the old immutable snapshot until lookup.
  const second = CjsGraph.getClassInfo(Child).compiled;
  assert.notEqual(first, second);
  assert.deepEqual(second.members.map(member => member.name), ["child", "parent"]);

  assert.equal(CjsGraph.define(Child, { name: "GraphRenamedChild", members: [{ name: "replacement", handler }] }), info);
  assert.throws(() => CjsGraph.getClassInfo("GraphLateChild"), TypeError);
  assert.deepEqual(CjsGraph.getClassInfo(Child).compiled.members.map(member => member.name), ["replacement", "parent"]);
});

test("failed registration does not mutate published definitions", () =>
{
  class Good {}
  class Other {}
  const info = CjsGraph.define(Good, { name: "GraphValidation", members: [{ name: "x", handler }] });
  const before = CjsGraph.getClassInfo(Good).compiled;
  assert.throws(() => CjsGraph.define(Other, { name: "GraphValidation", members: [] }), TypeError);
  assert.throws(() => CjsGraph.define(Good, { name: "GraphValidation", members: [
    { name: "x", handler }, { name: "x", handler }
  ] }), TypeError);
  assert.equal(CjsGraph.getClassInfo(Good).compiled, before);
  assert.equal(info.declared.members.length, 1);
  assert.throws(() => CjsGraph.getClassInfo(Other), TypeError);
  assert.throws(() => CjsGraph.define({}, { name: "GraphInvalidCtor" }), TypeError);
});

test("untyped members share the throwing Invalid handler until explicitly defined", () =>
{
  class Untyped {}
  const info = CjsGraph.define(Untyped, { name: "GraphDefaultHandler", members: [
    { name: "first" }, { name: "second", handler: null }
  ] });
  const members = CjsGraph.getClassInfo(Untyped).compiled.members;
  assert.equal(members[0].handler.name, "Invalid");
  assert.equal(members[0].handler, members[1].handler);
  assert.equal(info.declared.members[0].handler, members[0].handler);
  assert.throws(() => members[0].handler.Get({}, "first"), /Invalid type handler.*first/);
  CjsGraph.define(Untyped, { name: "GraphDefaultHandler", members: [{ name: "first", handler }] });
  assert.equal(CjsGraph.getClassInfo(Untyped), info);
  assert.equal(info.compiled.members[0].handler, handler);
});

test("compiled lookup accepts object-prototype names without collision", () =>
{
  class Names {}
  CjsGraph.define(Names, { name: "GraphSpecialNames", members: [
    { name: "__proto__", handler }, { name: "constructor", handler }
  ] });
  const compiled = CjsGraph.getClassInfo(Names).compiled;
  assert.equal(compiled.byName.__proto__[0].name, "__proto__");
  assert.equal(compiled.byName.constructor[0].name, "constructor");
});

test("Blue and graph use the single Carbon VARTYPE enum", () =>
{
  assert.equal(new VarEntry().type, VARTYPE.INVALID);
  assert.equal(VARTYPE.FLOATARRAY, 15);
  assert.equal(VARTYPE.VARTYPE_FORCELONG, 0xffffffff);
  assert.equal(Object.isFrozen(VARTYPE), true);
});

test("policy can skip a hidden derived candidate without losing the visible base", () =>
{
  class Visible {}
  class Hidden extends Visible {}
  const HIDDEN = 0x008;
  CjsGraph.define(Visible, { name: "GraphVisibleBase", members: [{ name: "x", key: "base", handler, flags: 0 }] });
  CjsGraph.define(Hidden, { name: "GraphHiddenDerived", members: [{ name: "x", key: "derived", handler, flags: HIDDEN }] });
  const candidates = CjsGraph.getClassInfo(Hidden).compiled.byName.x;
  assert.deepEqual(candidates.map(member => member.key), ["derived", "base"]);
  assert.equal(candidates.find(member => !(member.flags & HIDDEN)).key, "base");
});
