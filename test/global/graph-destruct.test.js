import assert from "node:assert/strict";
import { test } from "node:test";
import { CjsGraph, CjsGraphRoot } from "../../src/global/model/graph/index.js";

test("graph teardown runs three owning levels once with members and arguments intact", () =>
{
  const calls = [], argument = new Set();
  class Base extends CjsGraphRoot
  {
    values = [ 1, 2 ];
    OnDestruct(value) { calls.push([ "base", this.values.length, value ]); }
  }
  class Middle extends Base
  {
    OnDestruct(value) { calls.push([ "middle", this.values.length, value ]); }
  }
  class Derived extends Middle
  {
    OnDestruct(value) { calls.push([ "derived", this.values.length, value ]); }
  }
  CjsGraph.define(Base, { name: "DestructBase", onDestruct: Base.prototype.OnDestruct });
  CjsGraph.define(Middle, { name: "DestructMiddle", bases: [ Base ], onDestruct: Middle.prototype.OnDestruct });
  CjsGraph.define(Derived, { name: "DestructDerived", bases: [ Middle ], onDestruct: Derived.prototype.OnDestruct });
  const object = new Derived();
  object.Destruct(argument);
  assert.deepEqual(calls, [ [ "derived", 2, argument ], [ "middle", 2, argument ], [ "base", 2, argument ] ]);
  assert.deepEqual(object.values, [ 1, 2 ]);
  assert.equal(object.__cjs.destructed, false, "dispatch adds no destruction-state policy");
});

test("diamond and repeated base declarations put every derived hook before shared ancestors", () =>
{
  const calls = [];
  class A {} class B {} class C {} class D {}
  CjsGraph.define(A, { name: "DestructDiamondA", onDestruct() { calls.push("A"); } });
  CjsGraph.define(B, { name: "DestructDiamondB", bases: [ A ], onDestruct() { calls.push("B"); } });
  CjsGraph.define(C, { name: "DestructDiamondC", bases: [ A ], onDestruct() { calls.push("C"); } });
  CjsGraph.define(D, { name: "DestructDiamondD", bases: [ B, "DestructDiamondC", B ], onDestruct() { calls.push("D"); } });
  CjsGraph.destruct(new D());
  assert.deepEqual(calls, [ "D", "C", "B", "A" ]);
});

test("teardown declarations remain separate from exposure chains and inherited method lookup", () =>
{
  let calls = 0;
  class Parent { OnDestruct() { calls++; } }
  class Child extends Parent {}
  class ExposureOnly {}
  CjsGraph.define(ExposureOnly, { name: "DestructExposureOnly", onDestruct() { throw new Error("not ancestry"); } });
  CjsGraph.define(Parent, { name: "DestructParent", onDestruct: Parent.prototype.OnDestruct });
  CjsGraph.define(Child, { name: "DestructChild", bases: [ Parent ], chainTo: "DestructExposureOnly" });
  CjsGraph.destruct(new Child());
  assert.equal(calls, 1);
});

test("late base replacement invalidates cached teardown and hooks own idempotence", () =>
{
  let released = 0;
  class Base {} class Child { held = true; }
  CjsGraph.define(Base, { name: "DestructLateBase" });
  CjsGraph.define(Child, { name: "DestructLateChild", bases: [ Base ] });
  const object = new Child();
  CjsGraph.destruct(object);
  CjsGraph.define(Base, { name: "DestructLateBase", onDestruct() { if (this.held) { this.held = false; released++; } } });
  CjsGraph.destruct(object);
  CjsGraph.destruct(object);
  assert.equal(released, 1);
});

test("malformed ancestry fails before invoking any teardown body", () =>
{
  class A {} class B {}
  const onDestruct = () => assert.fail("partial teardown");
  CjsGraph.define(A, { name: "DestructCycleA", bases: [ B ], onDestruct });
  assert.throws(() => CjsGraph.destruct(new A()), /Unknown graph base/);
  CjsGraph.define(B, { name: "DestructCycleB", bases: [ A ], onDestruct });
  assert.throws(() => CjsGraph.destruct(new A()), /Cyclic graph ancestry/);
  assert.throws(() => CjsGraph.define(B, { name: "DestructCycleB", onDestruct: true }), /function or null/);
});

test("hook errors propagate without introducing automatic member release", () =>
{
  class Broken { held = { value: 1 }; }
  CjsGraph.define(Broken, { name: "DestructBroken", onDestruct() { throw new Error("hook failure"); } });
  const object = new Broken();
  assert.throws(() => CjsGraph.destruct(object), /hook failure/);
  assert.deepEqual(object.held, { value: 1 });
});
