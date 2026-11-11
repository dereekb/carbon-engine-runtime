import assert from "node:assert/strict";
import { test } from "node:test";
import { CjsSchema } from "../../npm/dist/blue/schema/index.js";
import { CjsGraph } from "../../npm/dist/global/model/graph/index.js";
import { CjsBlueGraph } from "../../npm/dist/blue/formats/graph/index.js";

test("Blue declares own hooks without activating graph values or copying mixin hooks", () =>
{
  const calls = [], argument = new Set();
  class Primary { OnDestruct(arg) { calls.push([ "primary", arg ]); } }
  class Secondary { OnDestruct(arg) { calls.push([ "secondary", arg ]); } }
  class Owner extends Primary { OnDestruct(arg) { calls.push([ "owner", arg ]); } }
  CjsSchema.meta.define("LifetimeBridgePrimary")(Primary);
  CjsSchema.meta.define("LifetimeBridgeSecondary")(Secondary);
  CjsSchema.meta.inherit(Secondary)(Owner);
  CjsSchema.meta.define("LifetimeBridgeOwner")(Owner);
  assert.equal(CjsGraph.isDefined(Owner), false);
  const object = new Owner();
  object.Destruct(argument);
  assert.deepEqual(calls, [ [ "owner", argument ], [ "secondary", argument ], [ "primary", argument ] ]);
  CjsBlueGraph.define(Owner, "LifetimeBridgeOwner");
  assert.equal(CjsGraph.isDefined(Owner), true);
  calls.length = 0;
  object.Destruct(argument);
  assert.deepEqual(calls.map(row => row[0]), [ "owner", "secondary", "primary" ]);

  class Composed {}
  CjsSchema.meta.inherit(Secondary)(Composed);
  CjsSchema.meta.define("LifetimeBridgeComposed")(Composed);
  assert.equal(Object.hasOwn(Composed.prototype, "OnDestruct"), false);
  calls.length = 0;
  new Composed().Destruct(argument);
  assert.deepEqual(calls, [ [ "secondary", argument ] ]);
});

test("registration preserves inherited legacy Destruct until its owner is migrated", () =>
{
  let calls = 0;
  class Legacy { Destruct() { calls++; } }
  class Derived extends Legacy { OnDestruct() { assert.fail("legacy owner must not be bypassed"); } }
  CjsSchema.meta.define("LifetimeBridgeLegacy")(Legacy);
  CjsSchema.meta.define("LifetimeBridgeLegacyChild")(Derived);
  new Derived().Destruct();
  assert.equal(calls, 1);
  assert.equal(Object.hasOwn(Derived.prototype, "Destruct"), false);
});

test("late composed-base registration invalidates an already used teardown list", () =>
{
  const calls = [];
  class Owner { OnDestruct() { calls.push("own"); } }
  class Late { OnDestruct() { calls.push("late"); } }
  CjsSchema.meta.define("LifetimeBridgeLateOwner")(Owner);
  CjsSchema.meta.define("LifetimeBridgeLateBase")(Late);
  const object = new Owner();
  object.Destruct();
  CjsSchema.meta.inherit(Late)(Owner);
  object.Destruct();
  assert.deepEqual(calls, [ "own", "own", "late" ]);
});
