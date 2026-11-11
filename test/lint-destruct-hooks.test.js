import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSource } from "../scripts/lint-destruct-hooks.js";

test("destructor hooks reject manual super and prototype teardown calls", () =>
{
  for (const body of [ "super.OnDestruct();", "super['Destruct']();", "Base.prototype.OnDestruct.call(this);", "Base.prototype['Destruct'].apply(this, []);" ])
    assert.notEqual(checkSource(`class Owner extends Base { OnDestruct() { ${body} } }`).length, 0, body);
  assert.notEqual(checkSource("class Owner extends Base { OnDestruct = () => super.OnDestruct(); }").length, 0);
});

test("destructor lint permits ordinary super methods and owned-member cleanup", () =>
{
  assert.deepEqual(checkSource("class Owner extends Base { Update() { super.Update(); } OnDestruct() { this.buffer.Destroy(); this.child.Destruct(); } }"), []);
  assert.deepEqual(checkSource("class Owner { OnDestruct() { class Nested extends Base { Update() { super.Update(); } } } }"), []);
});
