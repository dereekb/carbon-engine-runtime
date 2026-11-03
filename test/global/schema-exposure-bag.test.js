import assert from "node:assert/strict";
import test from "node:test";
import { transformSync } from "@babel/core";
import decoratorsPlugin from "@babel/plugin-proposal-decorators";
import { exposure as be } from "#be";
import { CjsSchema } from "../../src/blue/schema/index.js";
import { BlueClasses } from "../../src/blue/blueexposure/BlueClasses.js";
import { mappedInterfaces } from "../../src/blue/compose/interface.js";
import { blueEnums } from "../../src/blue/blue/enums/CjsBlueEnumRegistry.js";

blueEnums.RegisterEnum("test.BagProbeEnum", { NONE: 0, ONE: 1 }, { chooser: [ { name: "NONE", value: 0 }, { name: "ONE", value: 1 } ] });

// decorator-upgrade.md § 000a: be.define(bag) declares a class's whole exposure block once, in Carbon's order. The bag must register
// exactly what the per-member be.map* decorators register; only the stored row order is new.

const beUrl = new URL("../../src/blue/blueexposure/be.js", import.meta.url).href;
const schemaUrl = new URL("../../src/blue/schema/index.js", import.meta.url).href;
async function load(source)
{
    const header = `import { exposure as be } from ${JSON.stringify(beUrl)}; import { meta, type } from ${JSON.stringify(schemaUrl)};\n`;
    const code = transformSync(header + source, { configFile: false, babelrc: false, plugins: [ [ decoratorsPlugin, { version: "2023-11" } ] ] }).code;
    return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
}

// One class body, declared both ways. Fields sit in "our" layout order (public, then private), not Carbon's.
const BODY = `
    @type.uint32 count = 0;
    @type.float32 speed = 0;
    @type.int32 mode = 0;
    @type.object.ref("BagProbeTarget") _target = null;
    @type.float32 shown = 0;
    values = new Float32Array(3);
    get stored() { return this._stored; }
    set stored(value) { this._stored = value; }
    _stored = 0;
    get readOnly() { return 1; }
    Rebuild() {}
    Plain() {}
    ResolvePathW() {}`;

const PER_MEMBER = `
  class Interface1 {}
  class Interface2 {}
  class Parent {}
  @be.define("BagProbePerMember")
  @be.inherit(Interface1)
  @be.mapInterface(Interface1)
  @be.mapInterface(Interface2)
  @be.exposureChainTo(Parent)
  export class BagProbePerMember
  {
    @be.mapAttribute(be.READWRITE | be.PERSIST) @type.uint32 count = 0;
    @be.mapAttribute(be.READ) @type.float32 speed = 0;
    @be.mapAttributeWithChooser(be.READWRITE | be.PERSIST | be.ENUM, "test.BagProbeEnum") @type.int32 mode = 0;
    @be.mapAttribute(be.PERSISTONLY, "target") @type.object.ref("BagProbeTarget") _target = null;
    @be.mapProperty__Field() @type.float32 shown = 0;
    @be.mapAttribute__Index(be.READWRITE, "first", 0) values = new Float32Array(3);
    @be.mapPropertyPersisted() get stored() { return this._stored; }
    set stored(value) { this._stored = value; }
    _stored = 0;
    @be.mapPropertyReadOnly("readOnlyValue") get readOnly() { return 1; }
    @be.mapMethodAndWrap() Rebuild() {}
    @be.mapMethod() Plain() {}
    @be.mapMethodAsMethod("ResolvePath") ResolvePathW() {}
  }
  export { Interface1, Interface2, Parent };`;

const BAG = `
  import { Interface1, Interface2, Parent } from "PER_MEMBER";
  @be.define({
    name: "BagProbeBag",
    inherit: [ Interface1 ],
    interfaces: [ Interface1, Interface2 ],
    members: [
      [ be.ATTR_INDEX, "first", be.READWRITE, 0, "values" ],
      [ be.PROP_PERSISTED, "stored" ],
      [ be.ATTR, "target", be.PERSISTONLY, "_target" ],
      [ be.METHOD, "Plain" ],
      [ be.ATTR, "speed", be.READ ],
      [ be.ATTR_CHOOSER, "mode", be.READWRITE | be.PERSIST | be.ENUM, "test.BagProbeEnum" ],
      [ be.PROP, "shown" ],
      [ be.PROP_RO, "readOnlyValue", "readOnly" ],
      [ be.METHOD, "Rebuild", be.WRAP ],
      [ be.ATTR, "count", be.READWRITE | be.PERSIST ],
      [ be.METHOD, "ResolvePath", be.AS_METHOD, "ResolvePathW" ]
    ],
    chainTo: Parent
  })
  export class BagProbeBag
  {${BODY}
  }`;

/** A table entry without what differs by construction: the registered name and the declaring class. */
function comparable(entry)
{
    const { declaringClass, ...rest } = entry;
    return JSON.parse(JSON.stringify(rest, (key, value) => typeof value === "function" ? `fn:${value.name}` : value));
}

function byName(list)
{
    return Object.fromEntries(list.map(entry => [ entry.name, comparable(entry) ]));
}

test("a bag registers the same members, properties, methods and interfaces as the per-member decorators", async () =>
{
    const perMember = await load(PER_MEMBER);
    globalThis.__bagProbe = perMember;
    const { BagProbeBag } = await load(BAG.replace(`import { Interface1, Interface2, Parent } from "PER_MEMBER";`, "const { Interface1, Interface2, Parent } = globalThis.__bagProbe;"));
    const { BagProbePerMember } = perMember;

    const left = CjsSchema.getSchema(BagProbePerMember), right = CjsSchema.getSchema(BagProbeBag);
    for (const table of [ "members", "properties", "methods", "fields" ])
        assert.deepEqual(byName(right[table]), byName(left[table]), table);

    const interfaces = Class => [ ...mappedInterfaces(Class) ].map(Interface => Interface === Class ? "self" : Interface.name);
    assert.deepEqual(interfaces(BagProbeBag), interfaces(BagProbePerMember), "the interface table, in Carbon's order");

    const typeInfo = Class =>
    {
        const [ , ifaces, members, methods ] = BlueClasses._typeInfo(Class, 0);
        return { ifaces: ifaces.length, members: Object.fromEntries(Object.entries(members).map(([ key, value ]) => [ key, comparable(value) ])), methods: Object.keys(methods).sort() };
    };
    assert.deepEqual(typeInfo(BagProbeBag), typeInfo(BagProbePerMember), "Blue's type information");

    assert.deepEqual(right.exposureRows.map(row => row.name), [
        "first", "stored", "target", "Plain", "speed", "mode", "shown", "readOnlyValue", "Rebuild", "count", "ResolvePath"
    ], "the bag keeps its row order");
    assert.equal(left.exposureRows, undefined, "a per-member class records no row order");
});

test("meta.define(bag) declares ours: the same rows without Carbon's stamp", async () =>
{
    const { OursBag } = await load(`
      @meta.define({ name: "BagProbeOurs", members: [ [ meta.ATTR, "count", meta.READWRITE | meta.PERSIST ] ] })
      export class OursBag { @type.uint32 count = 0; }`);
    const [ member ] = CjsSchema.getSchema(OursBag).members;
    assert.equal(member.name, "count");
    assert.equal(member.exposure.origin, "ours");
    assert.equal(member.carbon, undefined);
});

test("a row naming a method the class lacks, or an unknown kind, fails at class definition", async () =>
{
    await assert.rejects(load(`@be.define({ name: "BagProbeNoMethod", members: [ [ be.METHOD, "Missing", be.WRAP ] ] }) export class A {}`), /no method "Missing"/);
    await assert.rejects(load(`@be.define({ name: "BagProbeBadKind", members: [ [ "nonsense", "x" ] ] }) export class B { x = 0; }`), /unknown row kind/);
});

test("an index row on a float vector member reads as its float component", async () =>
{
    const { BagProbeSphere, BagProbeSphereRows } = await load(`
      @be.define({ name: "BagProbeSphere", members: [ [ be.ATTR_INDEX, "radius", be.READ, 3, "sphere" ] ] })
      export class BagProbeSphere { @type.vec4 sphere = new Float32Array([ 1, 2, 3, 4 ]); }
      @be.define("BagProbeSphereRows")
      export class BagProbeSphereRows { @be.mapAttribute__Index(be.READ, "radius", 3) @type.vec4 sphere = new Float32Array([ 1, 2, 3, 4 ]); }`);
    const radius = Class => CjsSchema.getSchema(Class).members.find(member => member.name === "radius");
    assert.deepEqual(comparable(radius(BagProbeSphere)), comparable(radius(BagProbeSphereRows)), "the bag and the per-member decorator agree");
    assert.deepEqual([ radius(BagProbeSphere).key, radius(BagProbeSphere).index, radius(BagProbeSphere).type.kind ], [ "sphere", 3, "float32" ]);
    const { readDictionaryValue } = await import("../../src/blue/blue/dictionaryDeclarations.js");
    assert.equal(readDictionaryValue(new BagProbeSphere(), radius(BagProbeSphere)), 4);
});

test("a bag row on an inherited member registers as the class-level row does, with the base's type", async () =>
{
    const { InheritedRows, InheritedBag } = await load(`
      @be.define("BagProbeInheritBase")
      class Base
      {
        @be.mapAttribute(be.READ) @type.boolean useSRT = false;
        get live() { return 1; }
        Rebuild() {}
      }
      @be.define("BagProbeInheritedRows")
      @be.mapAttribute(be.READWRITE | be.PERSIST, "useSRT")
      @be.mapMethodAndWrap("Rebuild")
      export class InheritedRows extends Base {}
      @be.define({ name: "BagProbeInheritedBag", members: [
        [ be.ATTR, "useSRT", be.READWRITE | be.PERSIST ],
        [ be.METHOD, "Rebuild", be.WRAP ]
      ] })
      export class InheritedBag extends Base {}`);
    const own = (Class, table) => byName(CjsSchema.getSchema(Class)[table].filter(entry => entry.declaringClass === Class));
    assert.deepEqual(own(InheritedBag, "members"), own(InheritedRows, "members"));
    const useSRT = CjsSchema.getSchema(InheritedBag).members.find(member => member.name === "useSRT" && member.declaringClass === InheritedBag);
    assert.equal(useSRT.type.kind, "boolean", "the base member's type");
    assert.equal(useSRT.edit.persist, true, "the subclass's own flags");
    const methods = Class => Object.keys(BlueClasses._typeInfo(Class, 0)[3]).sort();
    assert.deepEqual(methods(InheritedBag), methods(InheritedRows));
});
