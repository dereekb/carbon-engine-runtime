import assert from "node:assert/strict";
import { test } from "node:test";
import { compareBag, readBags, readCarbonExposures } from "../../scripts/lint-exposure-bags.js";

let order = 0;
const row = (kind, fields) => ({ kind, source: "eve/Fixture_Blue.cpp", line: 10 + order, order: order++, condition: null, ...fields });

/** A scanned exposure block in the carbon-blue report's shape. */
function fixtureRows()
{
    order = 0;
    return [
        row("INTERFACE", { name: "Fixture", macro: "MAP_INTERFACE" }),
        row("INTERFACE", { name: "IListNotify", macro: "MAP_INTERFACE" }),
        row("ATTR", { name: "speed", member: "m_speed", flags: [ "READ" ], macro: "MAP_ATTRIBUTE" }),
        row("ATTR", { name: "mode", member: "m_mode", flags: [ "READWRITE", "PERSIST", "ENUM" ], chooser: "FixtureMode", macro: "MAP_ATTRIBUTE_WITH_CHOOSER" }),
        row("FUNCTION", { name: "MakeFixture", target: "MakeFixture", macro: "MAP_FUNCTION" }),
        row("ATTR", { name: "boosters", member: "m_boosters", flags: [ "PERSISTONLY" ], macro: "MAP_ATTRIBUTE" }),
        row("PROP", { name: "boosters", getter: "GetBoosters", setter: "SetBoosters", macro: "MAP_PROPERTY" }),
        row("METHOD", { name: "IsReady", target: "IsDataReady", macro: "MAP_METHOD_AND_WRAP" }),
        row("ICACHEABLE", { name: null, expandsTo: [ "IsMemoryUsageKnown", "GetMemoryUsage" ], macro: "MAP_ICACHEABLE_METHODS" }),
        row("CHAINTO", { name: "FixtureBase", macro: "EXPOSURE_CHAINTO" })
    ];
}

const members = [
    "[ be.ATTR, \"speed\", be.READ ]",
    "[ be.ATTR_CHOOSER, \"mode\", be.READ | be.WRITE | be.PERSIST | be.ENUM, FixtureMode ]",
    "[ be.ATTR, \"boosters\", be.PERSISTONLY, \"_boosters\" ]",
    "[ be.PROP, \"boosters\" ]",
    "[ be.METHOD, \"IsReady\", be.WRAP, \"IsDataReady\" ]",
    "[ be.ICACHEABLE_METHODS ]"
];

function bagSource({ rows = members, interfaces = "[ IListNotify ]", chainTo = "FixtureBase", name = "Fixture", body = "" } = {})
{
    return `@be.define({
  name: "${name}",
  inherit: [ IListNotify ],
  interfaces: ${interfaces},
  members: [
    ${rows.join(",\n    ")}
  ],
  ${chainTo ? `chainTo: ${chainTo}` : ""}
})
export class Fixture extends FixtureBase { ${body} }`;
}

const keys = (source, rows = fixtureRows()) => compareBag(readBags(source)[0], rows).map(finding => finding.key);

test("a bag that matches Carbon's block row for row has no findings", () =>
{
    assert.deepEqual(keys(bagSource()), []);
});

test("bags are read only from be.define with an object naming the class", () =>
{
    assert.equal(readBags("@be.define(\"Fixture\") class A {}").length, 0);
    assert.equal(readBags("@meta.define({ name: \"Ours\", members: [] }) class A {}").length, 0);
    assert.equal(readBags(bagSource()).length, 1);
});

test("rows out of Carbon's order are one order finding", () =>
{
    const swapped = [ members[2], members[0], ...members.slice(1, 2), ...members.slice(3) ];
    assert.deepEqual(keys(bagSource({ rows: swapped })), [ "order" ]);
});

test("flags compare as Carbon's EDITFLAGS values", () =>
{
    const rows = [ "[ be.ATTR, \"speed\", be.READWRITE ]", ...members.slice(1) ];
    assert.deepEqual(keys(bagSource({ rows })), [ "attribute speed flags" ]);
});

test("an attribute lands on its exposed name; underscore plus its name only for a member private in Blue", () =>
{
    // boosters is PERSISTONLY (HIDDEN), so "_boosters" is accepted, and so is the exposed name.
    const withKey = key => [ ...members.slice(0, 2), `[ be.ATTR, "boosters", be.PERSISTONLY${key ? `, "${key}"` : ""} ]`, ...members.slice(3) ];
    assert.deepEqual(keys(bagSource({ rows: withKey("_boosterSet") })), [ "attribute boosters key" ]);
    assert.deepEqual(keys(bagSource({ rows: withKey(null) })), []);
    // speed is not HIDDEN: only its exposed name is the key.
    for (const key of [ "_speed", "speedValue" ])
    {
        const rows = [ `[ be.ATTR, "speed", be.READ, "${key}" ]`, ...members.slice(1) ];
        assert.deepEqual(keys(bagSource({ rows })), [ "attribute speed key" ], key);
    }
});

test("an exposed name that starts with m_ is keyed without it, the row keeping Carbon's name", () =>
{
    order = 0;
    const rows = [ row("ATTR", { name: "m_dampingRatio", member: "m_dampingRatio", flags: [ "READWRITE", "PERSIST" ], macro: "MAP_ATTRIBUTE" }) ];
    const source = key => bagSource({ rows: [ `[ be.ATTR, "m_dampingRatio", be.READWRITE | be.PERSIST${key ? `, "${key}"` : ""} ]` ], interfaces: "[]", chainTo: null });
    assert.deepEqual(keys(source("dampingRatio"), rows), []);
    assert.deepEqual(keys(source(null), rows), [ "attribute m_dampingRatio key" ]);
});

test("a method lands on Carbon's C++ method name", () =>
{
    const rows = [ ...members.slice(0, 4), "[ be.METHOD, \"IsReady\", be.WRAP ]", members[5] ];
    assert.deepEqual(keys(bagSource({ rows })), [ "method IsReady key" ]);
});

test("a method key may be an overload variant of the C++ name", () =>
{
    const rows = name => [ ...members.slice(0, 4), `[ be.METHOD, "IsReady", be.WRAP, "${name}" ]`, members[5] ];
    assert.deepEqual(keys(bagSource({ rows: rows("IsDataReady__Frame") })), []);
    assert.deepEqual(keys(bagSource({ rows: rows("IsDataReadyNow") })), [ "method IsReady key" ]);
});

test("the macro and method mode must match", () =>
{
    const rows = [ ...members.slice(0, 4), "[ be.METHOD, \"IsReady\", undefined, \"IsDataReady\" ]", members[5] ];
    assert.deepEqual(keys(bagSource({ rows })), [ "method IsReady kind" ]);
    const plain = [ members[0], "[ be.ATTR, \"mode\", be.READWRITE | be.PERSIST | be.ENUM ]", ...members.slice(2) ];
    assert.deepEqual(keys(bagSource({ rows: plain })), [ "attribute mode kind" ]);
});

test("rows missing from the bag, and rows Carbon does not write, are reported by name", () =>
{
    const rows = [ ...members.slice(0, 3), ...members.slice(4), "[ be.ATTR, \"extra\", be.READ ]" ];
    assert.deepEqual(keys(bagSource({ rows })).sort(), [ "attribute extra extra", "property boosters missing" ]);
});

test("interfaces and chainTo compare as sets; the class's own MAP_INTERFACE is implied", () =>
{
    assert.deepEqual(keys(bagSource({ interfaces: "[ IListNotify, INotify ]" })), [ "interface INotify extra" ]);
    assert.deepEqual(keys(bagSource({ interfaces: "[]" })), [ "interface IListNotify missing" ]);
    assert.deepEqual(keys(bagSource({ chainTo: null })), [ "chainTo FixtureBase missing" ]);
});

test("MAP_FUNCTION rows are module functions and never expected in a bag", () =>
{
    assert.ok(!keys(bagSource()).some(key => key.includes("MakeFixture")));
});

test("an indexed member is ATTR_INDEX, keyed by the array member's name", () =>
{
    order = 0;
    const rows = [ row("ATTR", { name: "sizeSTANDARD", member: "m_sizes[Fixture::USAGE_STANDARD]", flags: [ "READWRITE", "PERSIST" ], macro: "MAP_ATTRIBUTE" }) ];
    const source = name => bagSource({ rows: [ `[ be.ATTR_INDEX, "sizeSTANDARD", be.READWRITE | be.PERSIST, 0, "${name}" ]` ], interfaces: "[]", chainTo: null });
    assert.deepEqual(keys(source("sizes"), rows), []);
    assert.deepEqual(keys(source("_sizes"), rows), [ "attribute sizeSTANDARD key" ]);
    assert.deepEqual(keys(source("sizeList"), rows), [ "attribute sizeSTANDARD key" ]);
});

test("MAPFLOATARRAYSIZE is a property row on an accessor: PROP_RO for READ, PROP_PERSISTED for READWRITE | PERSIST", () =>
{
    order = 0;
    const floats = flags => [ row("ATTR", { name: "boundingSphereCenter", member: "m_boundingSphere", flags, length: 3, macro: "MAPFLOATARRAYSIZE" }) ];
    const getter = "get boundingSphereCenter() { return this._center; }";
    const source = (kind, body = getter) => bagSource({ rows: [ `[ be.${kind}, "boundingSphereCenter" ]` ], interfaces: "[]", chainTo: null, body });
    assert.deepEqual(keys(source("PROP_RO"), floats([ "READ" ])), []);
    assert.deepEqual(keys(source("PROP_PERSISTED"), floats([ "READWRITE", "PERSIST" ])), []);
    assert.deepEqual(keys(source("PROP"), floats([ "READ" ])), [ "property boundingSphereCenter kind" ]);
    assert.deepEqual(keys(source("PROP_RO", "boundingSphereCenter = null;"), floats([ "READ" ])), [ "property boundingSphereCenter accessor" ]);
    assert.deepEqual(keys(source("PROP_RO"), floats([ "READWRITE" ])), [ "property boundingSphereCenter no bag kind" ]);
});

test("a MAP_ATTRIBUTE over a field of an array element is a property row on an accessor", () =>
{
    order = 0;
    const rows = [ row("ATTR", { name: "firingDelay1", member: "m_perMuzzleData[0].constantDelay", flags: [ "READWRITE", "PERSIST" ], macro: "MAP_ATTRIBUTE" }) ];
    const source = (kind, body) => bagSource({ rows: [ `[ be.${kind}, "firingDelay1" ]` ], interfaces: "[]", chainTo: null, body });
    assert.deepEqual(keys(source("PROP_PERSISTED", "get firingDelay1() { return 0; } set firingDelay1(v) {}"), rows), []);
    assert.deepEqual(keys(source("PROP_PERSISTED", "firingDelay1 = 0;"), rows), [ "property firingDelay1 accessor" ]);
    assert.deepEqual(keys(bagSource({ rows: [ "[ be.ATTR, \"firingDelay1\", be.READWRITE | be.PERSIST ]" ], interfaces: "[]", chainTo: null }), rows), [ "attribute firingDelay1 extra", "property firingDelay1 missing" ]);
});

test("a macro the bag has no row kind for is reported, not guessed", () =>
{
    order = 0;
    const rows = [ row("METHOD", { name: "Call", target: "Call", macro: "MAP_METHOD_WITH_KEYWORD_ARGUMENTS" }) ];
    const source = bagSource({ rows: [ "[ be.METHOD, \"Call\" ]" ], interfaces: "[]", chainTo: null });
    assert.deepEqual(keys(source, rows), [ "method Call no bag kind" ]);
});

test("a bag naming no Carbon exposure is one finding", () =>
{
    assert.deepEqual(compareBag(readBags(bagSource())[0], undefined).map(finding => finding.key), [ "no Carbon exposure" ]);
});

test("Carbon's rows come from the record holding EXPOSURE_BEGIN, the first report winning", () =>
{
    const exposed = (rows, files) => ({ name: "Fixture", blue: { exposures: [ { name: "Fixture" } ], rows, files } });
    const headerOnly = { name: "Fixture", blue: { exposures: [], rows: [] } };
    const carbon = readCarbonExposures([ { classes: [ headerOnly, exposed([ 1 ]) ] }, { classes: [ exposed([ 2 ]) ] } ]);
    assert.deepEqual(carbon.get("Fixture"), [ 1 ]);
    assert.throws(() => readCarbonExposures([ { classes: [ { name: "Old", blue: { exposures: [ {} ] } } ] } ]), /predates exposure rows/);
});
