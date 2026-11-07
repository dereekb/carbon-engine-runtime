import assert from "node:assert/strict";
import test from "node:test";

import { blue } from "../../src/blue/index.js";
import { CjsBlueGraph } from "../../src/blue/formats/graph/index.js";
import { DictReader } from "../../src/blue/formats/graph/DictReader.js";
import { DictWriter } from "../../src/blue/formats/graph/DictWriter.js";
import { YamlWriter } from "../../src/blue/formats/yaml/YamlWriter.js";
import { CjsSchema, type } from "../../src/blue/schema/index.js";
import { getCarbonTypeDefinition } from "../../src/blue/schema/types/carbonTypes.js";
import { CjsGraph } from "../../src/global/model/graph/index.js";

// `type.object.ref.weak` is IROOTPTR in every way but one fact: the member does not own its target.
// Each test runs the same operation over `ref` and `ref.weak` and requires the same answer.

class RefWeakLeaf
{
  value = 0;
}
CjsSchema.define(RefWeakLeaf, { className: "RefWeakLeaf", fields: {
  value: [ type.int32, CjsSchema.be.persist ]
} });

class OwnedHolder
{
  target = null;
}
CjsSchema.define(OwnedHolder, { className: "RefWeakOwnedHolder", fields: {
  target: [ type.object.ref("RefWeakLeaf"), CjsSchema.be.persist ]
} });

class UnownedHolder
{
  target = null;
}
CjsSchema.define(UnownedHolder, { className: "RefWeakUnownedHolder", fields: {
  target: [ type.object.ref.weak("RefWeakLeaf"), CjsSchema.be.persist ]
} });

/** The same graph under each holder class. */
function holders(value = 7)
{
  return [ OwnedHolder, UnownedHolder ].map(Holder =>
  {
    const holder = new Holder();
    holder.target = Object.assign(new RefWeakLeaf(), { value });
    return holder;
  });
}

const field = Holder => CjsSchema.getSchema(Holder).members.find(member => member.name === "target");
const unnamed = values => ({ ...values, _type: "holder" });

test("ref.weak is the rootRef kind, with one more fact", () =>
{
  assert.deepEqual(field(OwnedHolder).type, { kind: "rootRef", className: "RefWeakLeaf" });
  assert.deepEqual(field(UnownedHolder).type, { kind: "rootRef", className: "RefWeakLeaf", owned: false });
  assert.deepEqual(getCarbonTypeDefinition(field(UnownedHolder).type), getCarbonTypeDefinition(field(OwnedHolder).type));
});

test("object.weak stays Carbon's weak reference", () =>
{
  class Weak { target = null; }
  CjsSchema.define(Weak, { className: "RefWeakRealWeak", fields: { target: type.object.weak("RefWeakLeaf") } });

  assert.deepEqual(field(Weak).type, { kind: "rootWeak", className: "RefWeakLeaf" });
});

test("a subclass that redeclares the member replaces the ownership fact", () =>
{
  class Redeclared extends UnownedHolder {}
  CjsSchema.define(Redeclared, { className: "RefWeakRedeclared", fields: {
    target: [ type.object.ref("RefWeakLeaf"), CjsSchema.be.persist ]
  } });

  const merged = CjsSchema.getSchema(Redeclared).fields.find(member => member.name === "target");
  assert.equal(Object.hasOwn(merged.type, "owned"), false);
});

test("values, reading and YAML writing match ref", () =>
{
  const [ owned, unowned ] = holders();

  assert.deepEqual(unnamed(new DictWriter().WriteObject(unowned, {}, {})), unnamed(new DictWriter().WriteObject(owned, {}, {})));
  assert.deepEqual(
    unnamed(CjsSchema.getValuesFromSchema(unowned, {}, {})),
    unnamed(CjsSchema.getValuesFromSchema(owned, {}, {}))
  );
  assert.equal(
    new YamlWriter().WriteObjectToString(unowned).replace("RefWeakUnownedHolder", "holder"),
    new YamlWriter().WriteObjectToString(owned).replace("RefWeakOwnedHolder", "holder")
  );

  const source = { target: { _type: "RefWeakLeaf", value: 9 } };
  const [ ownedInto, unownedInto ] = [ new OwnedHolder(), new UnownedHolder() ];
  new DictReader().ReadInto(ownedInto, source);
  new DictReader().ReadInto(unownedInto, source);

  assert.ok(unownedInto.target instanceof RefWeakLeaf);
  assert.equal(unownedInto.target.value, ownedInto.target.value);
});

test("copying makes a new target, as ref does", () =>
{
  for (const holder of holders())
  {
    const copy = new holder.constructor();
    assert.ok(blue.classes.CopyTo(holder, copy));
    assert.notEqual(copy.target, holder.target);
    assert.equal(copy.target.value, 7);
  }
});

test("Find reaches the target, as ref does", () =>
{
  for (const holder of holders())
  {
    assert.deepEqual(blue.classes.Find(holder, "test.RefWeakLeaf"), [ holder.target ]);
  }
});

test("the graph tells the member apart and every walk still reaches it", () =>
{
  CjsBlueGraph.define(RefWeakLeaf, "RefWeakLeaf");
  CjsBlueGraph.define(OwnedHolder, "RefWeakOwnedHolder");
  CjsBlueGraph.define(UnownedHolder, "RefWeakUnownedHolder");

  const member = Holder => CjsGraph.getClassInfo(Holder).compiled.byName.target[0];
  assert.equal(member(OwnedHolder).owned, true);
  assert.equal(member(UnownedHolder).owned, false);
  assert.deepEqual(member(UnownedHolder).edge, member(OwnedHolder).edge);

  // Default walk and cached selection, which resource walks use.
  const selection = CjsGraph.compileSelection({ matchClass: info => info.ctor === RefWeakLeaf });
  for (const holder of holders())
  {
    const visited = [];
    CjsGraph.traverse(holder, object => { visited.push(object); });
    assert.deepEqual(visited, [ holder, holder.target ]);
    assert.deepEqual(CjsGraph.select(holder, selection, []), [ holder.target ]);
  }

  // A walk that follows ownership stops at the member, with no change to the graph.
  const acceptMember = candidate => candidate.owned !== false;
  const [ owned, unowned ] = holders();
  const walk = root =>
  {
    const visited = [];
    CjsGraph.traverse(root, object => { visited.push(object); }, { acceptMember });
    return visited;
  };

  assert.deepEqual(walk(owned), [ owned, owned.target ]);
  assert.deepEqual(walk(unowned), [ unowned ]);
});
