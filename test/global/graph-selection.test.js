import assert from "node:assert/strict";
import { test } from "node:test";
import { CjsGraph, CjsGraphTypeObject } from "../../src/global/model/graph/index.js";

const handler = CjsGraphTypeObject;
const matchClass = info => info.declared.resource === true;

function sameIdentities(actual, expected)
{
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < actual.length; i++) assert.equal(actual[i], expected[i]);
}

test("cached resource selection matches full DFS identities/order while skipping dry cyclic branches", () =>
{
  class Resource {}
  class Dry { children = []; }
  class Link { next = null; resource = null; }
  class Root { dry = null; path = null; direct = null; }
  CjsGraph.define(Resource, { name: "SelectResource", resource: true });
  CjsGraph.define(Dry, { name: "SelectDry", members: [
    { name: "children", handler, edge: { kind: "embed", type: Dry, collection: true } }
  ] });
  CjsGraph.define(Link, { name: "SelectLink", members: [
    { name: "next", handler, edge: { kind: "ref", type: Link } },
    { name: "resource", handler, edge: { kind: "ref", type: Resource } }
  ] });
  CjsGraph.define(Root, { name: "SelectRoot", members: [
    { name: "dry", handler, edge: { kind: "embed", type: Dry } },
    { name: "path", handler, edge: { kind: "embed", type: Link } },
    { name: "direct", handler, edge: { kind: "ref", type: Resource } }
  ] });
  const root = new Root(), first = new Link(), second = new Link(), dry = new Dry();
  root.dry = dry;
  dry.children = [new Dry(), new Dry(), dry];
  root.path = first;
  first.next = second;
  second.next = first;
  first.resource = new Resource();
  second.resource = root.direct = new Resource();
  const expected = [];
  CjsGraph.traverse(root, (object, info) => { if (matchClass(info)) expected.push(object); });

  const selection = CjsGraph.compileSelection({ matchClass });
  const full = {}, cached = {};
  sameIdentities(CjsGraph.select(root, selection, [], { prune: false, stats: full }), expected);
  sameIdentities(CjsGraph.select(root, selection, [], { stats: cached }), expected);
  sameIdentities(expected, [second.resource, first.resource]);
  assert.equal(full.visited, 8);
  assert.equal(cached.visited, 5);
  assert.equal(cached.skippedEdges, 1);
  assert.equal(cached.compiledClasses, 0);

  // Prove pruning avoids reading the branch, not merely filtering its visited results.
  Object.defineProperty(root, "dry", { get() { throw new Error("dry branch read"); } });
  sameIdentities(CjsGraph.select(root, selection, []), expected);
  assert.throws(() => CjsGraph.select(root, selection, [], { prune: false }), /dry branch read/);
});

test("dynamic edges and registered subclasses cannot produce false negative reachability", () =>
{
  class Resource {}
  class Base {}
  class Derived extends Base { resource = null; }
  class Root { typed = null; dynamic = null; }
  CjsGraph.define(Resource, { name: "SelectDynamicResource", resource: true });
  CjsGraph.define(Base, { name: "SelectDynamicBase" });
  CjsGraph.define(Derived, { name: "SelectDynamicDerived", members: [
    { name: "resource", handler, edge: { kind: "ref", type: Resource } }
  ] });
  CjsGraph.define(Root, { name: "SelectDynamicRoot", members: [
    { name: "typed", handler, edge: { kind: "ref", type: Base } },
    { name: "dynamic", handler, edge: { kind: "ref" } }
  ] });
  const root = new Root();
  root.typed = new Derived();
  root.typed.resource = new Resource();
  root.dynamic = new Derived();
  root.dynamic.resource = new Resource();
  const diagnostics = [];
  const selection = CjsGraph.compileSelection({ matchClass }, diagnostics);
  const full = CjsGraph.select(root, selection, [], { prune: false });
  sameIdentities(CjsGraph.select(root, selection, []), full);
  sameIdentities(full, [root.typed.resource, root.dynamic.resource]);
  assert.ok(diagnostics.some(row => row.className === "SelectDynamicRoot" && row.member === "dynamic" && row.reason === "dynamic"));
});

test("reachability propagates through mutually recursive class declarations", () =>
{
  class A { b = null; }
  class B { a = null; resource = null; }
  class Resource {}
  CjsGraph.define(A, { name: "SelectCycleA", members: [
    { name: "b", handler, edge: { kind: "ref", type: B } }
  ] });
  CjsGraph.define(B, { name: "SelectCycleB", members: [
    { name: "a", handler, edge: { kind: "ref", type: A } },
    { name: "resource", handler, edge: { kind: "ref", type: Resource } }
  ] });
  CjsGraph.define(Resource, { name: "SelectCycleResource", resource: true });
  const root = new A();
  root.b = new B();
  root.b.a = root;
  root.b.resource = new Resource();
  const selection = CjsGraph.compileSelection({ matchClass });
  sameIdentities(CjsGraph.select(root, selection, []), [root.b.resource]);
  sameIdentities(CjsGraph.select(root, selection, [], { prune: false }), [root.b.resource]);
});

test("manually established prototype inheritance uses the same assignability for pruning and traversal", () =>
{
  class Base {}
  class Derived {}
  class Root { child = null; }
  Object.setPrototypeOf(Derived.prototype, Base.prototype);
  CjsGraph.define(Base, { name: "SelectPrototypeBase" });
  CjsGraph.define(Derived, { name: "SelectPrototypeDerived", resource: true });
  CjsGraph.define(Root, { name: "SelectPrototypeRoot", members: [
    { name: "child", handler, edge: { kind: "ref", type: Base } }
  ] });
  const root = new Root();
  root.child = new Derived();
  const selection = CjsGraph.compileSelection({ matchClass });
  sameIdentities(CjsGraph.select(root, selection, []), [root.child]);
  sameIdentities(CjsGraph.select(root, selection, [], { prune: false }), [root.child]);
});

test("late registration and redefinition rebuild negative reachability and class matches", () =>
{
  class Base {}
  class Derived extends Base {}
  class Root { child = null; unresolved = null; }
  class Later {}
  CjsGraph.define(Base, { name: "SelectLateBase" });
  CjsGraph.define(Root, { name: "SelectLateRoot", members: [
    { name: "child", handler, edge: { kind: "ref", type: Base } },
    { name: "unresolved", handler, edge: { kind: "ref", type: "SelectLateTarget" } }
  ] });
  const root = new Root();
  root.child = new Base();
  const diagnostics = [];
  const selection = CjsGraph.compileSelection({ matchClass }, diagnostics);
  assert.deepEqual(CjsGraph.select(root, selection, []), []);
  assert.ok(diagnostics.some(row => row.className === "SelectLateRoot" && row.reason === "unregistered target"));

  CjsGraph.define(Derived, { name: "SelectLateDerived", resource: true });
  CjsGraph.define(Later, { name: "SelectLateTarget", resource: true });
  root.child = new Derived();
  root.unresolved = new Later();
  const stats = {};
  sameIdentities(CjsGraph.select(root, selection, [], { stats }), [root.child, root.unresolved]);
  assert.ok(stats.compiledClasses > 0);
  CjsGraph.select(root, selection, [], { stats });
  assert.equal(stats.compiledClasses, 0);

  CjsGraph.define(Derived, { name: "SelectLateDerived", resource: false });
  sameIdentities(CjsGraph.select(root, selection, []), [root.unresolved]);
  sameIdentities(CjsGraph.select(root, selection, [], { prune: false }), [root.unresolved]);
});

test("selection retains hidden-derived fallback order, weak-edge policy and matching roots", () =>
{
  class Resource {}
  class Base { baseX = null; }
  class Root extends Base { y = null; weak = null; }
  CjsGraph.define(Resource, { name: "SelectPolicyResource", resource: true });
  CjsGraph.define(Base, { name: "SelectPolicyBase", members: [
    { name: "x", key: "baseX", handler, edge: { kind: "ref", type: Resource } }
  ] });
  CjsGraph.define(Root, { name: "SelectPolicyRoot", resource: true, members: [
    { name: "x", key: "hiddenX", hidden: true, handler, edge: { kind: "ref", type: Resource } },
    { name: "y", handler, edge: { kind: "ref", type: Resource } },
    { name: "weak", handler, edge: { kind: "weak", type: Resource } }
  ] });
  const root = new Root();
  root.y = new Resource();
  root.baseX = new Resource();
  root.weak = new Resource();
  const edges = ["ref", "weak"];
  const selection = CjsGraph.compileSelection({ matchClass, edges, acceptMember: member => !member.hidden });
  edges.length = 0;
  const expected = [root, root.y, root.weak, root.baseX];
  sameIdentities(CjsGraph.select(root, selection, []), expected);
  sameIdentities(CjsGraph.select(root, selection, [], { prune: false }), expected);
  const prefix = {};
  sameIdentities(CjsGraph.select(root, selection, [prefix]), [prefix, ...expected]);
});

test("typed edges are validated even after the same identity was visited through a dynamic edge", () =>
{
  class Resource {}
  class Other {}
  class Root { dynamic = null; typed = null; }
  CjsGraph.define(Resource, { name: "SelectActual", resource: true });
  CjsGraph.define(Other, { name: "SelectWrongType", resource: true });
  CjsGraph.define(Root, { name: "SelectWrongRoot", members: [
    { name: "dynamic", handler, edge: { kind: "ref" } },
    { name: "typed", handler, edge: { kind: "ref", type: Other } }
  ] });
  const root = new Root();
  root.dynamic = root.typed = new Resource();
  const selection = CjsGraph.compileSelection({ matchClass });
  const output = [];
  assert.throws(() => CjsGraph.select(root, selection, output), /not assignable/);
  sameIdentities(output, [root.dynamic]); // Failure leaves the caller's partial result intact.
  assert.throws(() => CjsGraph.select(root, selection, [], { prune: false }), /not assignable/);
  assert.equal(CjsGraph._traversalDepth, 0);
});

test("full traversal rejects a shared plain struct declared as two different classes", () =>
{
  class A {}
  class B {}
  class Root { a = null; b = null; }
  CjsGraph.define(A, { name: "SelectStructA" });
  CjsGraph.define(B, { name: "SelectStructB", resource: true });
  CjsGraph.define(Root, { name: "SelectStructRoot", members: [
    { name: "a", handler, edge: { kind: "embed", type: A } },
    { name: "b", handler, edge: { kind: "embed", type: B } }
  ] });
  const root = new Root();
  root.a = root.b = {};
  assert.throws(() => CjsGraph.traverse(root, () => {}), /conflicting declared types/);
  const selection = CjsGraph.compileSelection({ matchClass });
  assert.throws(() => CjsGraph.select(root, selection, [], { prune: false }), /conflicting declared types/);
  // The pruned path is not a validator of invalid storage it never reads.
});

test("selection compilation rejects mutation and retries a failed revision rebuild safely", () =>
{
  class Root {}
  CjsGraph.define(Root, { name: "SelectMutationRoot", resource: true });
  let mutate = false;
  const selection = CjsGraph.compileSelection({ matchClass(info)
  {
    if (mutate)
    {
      mutate = false;
      CjsGraph.define(Root, { name: "SelectMutationRoot", resource: true });
    }
    return matchClass(info);
  } });
  CjsGraph.define(Root, { name: "SelectMutationRoot", resource: true });
  mutate = true;
  assert.throws(() => CjsGraph.select(new Root(), selection, []), /changed during selection compilation/);
  assert.equal(CjsGraph._traversalDepth, 0);
  const root = new Root();
  sameIdentities(CjsGraph.select(root, selection, []), [root]);
});

test("nested selection from a getter uses independent operation state", () =>
{
  class Resource {}
  class Root { nested = false; }
  CjsGraph.define(Resource, { name: "SelectNestedResource", resource: true });
  CjsGraph.define(Root, { name: "SelectNestedRoot", members: [
    { name: "resource", handler, edge: { kind: "ref", type: Resource } }
  ] });
  const root = new Root(), resource = new Resource(), nested = [];
  const selection = CjsGraph.compileSelection({ matchClass });
  Object.defineProperty(root, "resource", { get()
  {
    if (!this.nested)
    {
      this.nested = true;
      CjsGraph.select(root, selection, nested);
    }
    return resource;
  } });
  sameIdentities(CjsGraph.select(root, selection, []), [resource]);
  sameIdentities(nested, [resource]);
});

test("measure cold compilation, warm full/pruned walks and registration rebuild separately", {
  skip: !process.env.CJS_GRAPH_SELECTION_BENCH && "Set CJS_GRAPH_SELECTION_BENCH=1 for the synthetic timing comparison."
}, context =>
{
  class Resource {}
  class Dry { next = null; }
  class Path { next = null; resource = null; }
  class Root { dry = null; path = null; }
  CjsGraph.define(Resource, { name: "BenchSelectionResource", resource: true });
  CjsGraph.define(Dry, { name: "BenchSelectionDry", members: [
    { name: "next", handler, edge: { kind: "embed", type: Dry } }
  ] });
  CjsGraph.define(Path, { name: "BenchSelectionPath", members: [
    { name: "next", handler, edge: { kind: "ref", type: Path } },
    { name: "resource", handler, edge: { kind: "ref", type: Resource } }
  ] });
  CjsGraph.define(Root, { name: "BenchSelectionRoot", members: [
    { name: "dry", handler, edge: { kind: "embed", type: Dry } },
    { name: "path", handler, edge: { kind: "embed", type: Path } }
  ] });

  const root = new Root(), resources = Array.from({ length: 20 }, () => new Resource());
  let dry = root.dry = new Dry();
  for (let i = 1; i < 20000; i++) dry = dry.next = new Dry();
  let path = root.path = new Path();
  for (let i = 0; i < 200; i++)
  {
    path.resource = resources[i % resources.length];
    if (i < 199) path = path.next = new Path();
  }
  path.next = root.path;

  const compileStart = performance.now();
  const selection = CjsGraph.compileSelection({ matchClass });
  const compileMs = performance.now() - compileStart;
  const fullStats = {}, prunedStats = {};
  const fullOptions = { prune: false, stats: fullStats }, prunedOptions = { stats: prunedStats };
  sameIdentities(CjsGraph.select(root, selection, [], prunedOptions), CjsGraph.select(root, selection, [], fullOptions));
  assert.equal(fullStats.visited, 20221);
  assert.equal(prunedStats.visited, 221);

  const fullOutput = [], prunedOutput = [];
  const fullTimes = [], prunedTimes = [];
  // Alternate order and discard warmup. No timing thresholds: measurements are evidence, not assertions.
  for (let i = 0; i < 70; i++)
  {
    for (let j = 0; j < 2; j++)
    {
      const full = (i + j) % 2 === 0;
      const output = full ? fullOutput : prunedOutput;
      output.length = 0;
      const start = performance.now();
      CjsGraph.select(root, selection, output, full ? fullOptions : prunedOptions);
      const elapsed = performance.now() - start;
      if (i >= 20) (full ? fullTimes : prunedTimes).push(elapsed);
    }
  }
  sameIdentities(fullOutput, prunedOutput);
  assert.equal(fullStats.compiledClasses, 0);
  assert.equal(prunedStats.compiledClasses, 0);

  CjsGraph.define(Dry, { name: "BenchSelectionDry", members: [
    { name: "next", handler, edge: { kind: "embed", type: Dry } }
  ] });
  const rebuildStart = performance.now();
  CjsGraph.select(null, selection, [], { stats: prunedStats });
  const rebuildMs = performance.now() - rebuildStart;
  assert.ok(prunedStats.compiledClasses > 0);
  fullTimes.sort((a, b) => a - b);
  prunedTimes.sort((a, b) => a - b);
  context.diagnostic(JSON.stringify({
    fixture: "synthetic, 20000 dry nodes + 200 path nodes + 20 shared resources + root",
    compileMs, rebuildMs, compiledClasses: prunedStats.compiledClasses,
    samples: fullTimes.length, fullVisited: 20221, prunedVisited: 221,
    fullMedianMs: fullTimes[25], prunedMedianMs: prunedTimes[25]
  }));
});
