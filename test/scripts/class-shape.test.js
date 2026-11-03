import assert from "node:assert/strict";
import { test } from "node:test";
import { checkSource } from "../../scripts/lint-class-shape.js";

const fieldProblems = code => checkSource(code, "src/Fixture.js").filter(problem => problem.includes("has no initializer"));

test("a class field with no initializer is a problem, public, private, underscored or static", () =>
{
    const problems = fieldProblems(`class Fixture
{
    _schema;
    #entries;
    static instances;
    name = "";
}`);
    assert.deepEqual(problems.map(problem => problem.split(" ")[1]), [ "Fixture._schema", "Fixture.#entries", "Fixture.instances" ]);
});

test("a field with a default by meaning passes, and so does a decorated one", () =>
{
    assert.deepEqual(fieldProblems(`class Fixture
{
    _schema = null;
    _receive = null;
    count = 0;
    label = "";
    @type.float32
    speed = 0;
    get value() { return this._schema; }
    Method() {}
}`), []);
});

test("a decorated field without a value is still a problem", () =>
{
    assert.deepEqual(fieldProblems("class Fixture { @type.float32 speed; }").length, 1);
});
