import assert from "node:assert/strict";
import { test } from "node:test";
import { findModuleExportHits } from "../../scripts/lint-module-exports.js";

const BE = 'import { exposure as be } from "#be";\n';

for (const [ source, rule ] of [
    [ "export class Widget {}\nexport default Widget;", "default-export" ],
    [ "export default class Widget {}", "default-export" ],
    [ 'export { Widget, Widget as default } from "./Widget.js";', "default-export" ],
    [ 'export { Widget, default } from "./Widget.js";', "default-export" ],
    [ "class Widget {}\nexport { Widget as default };", "default-export" ],
    [ `${BE}export class Widget {}`, "unused-be-import" ],
    [ `${BE}export class Widget { Run(be) { return be.x; } }`, "unused-be-import" ]
]) test(`module-exports lint rejects ${JSON.stringify(source)}`, () =>
{
    assert.deepEqual(findModuleExportHits(source).map(hit => hit.rule), [ rule ]);
});

for (const source of [
    'export class Widget {}\nexport { Widget as Gadget };\nexport * from "./other.js";',
    `${BE}@be.define("Widget")\nexport class Widget {}`,
    `${BE}export class Widget {}\nbe.inherit(Base)(Widget);`,
    `${BE}const exposure = be.READ;`,
    `${BE}export { be };`
]) test(`module-exports lint accepts ${JSON.stringify(source)}`, () =>
{
    assert.deepEqual(findModuleExportHits(source), []);
});
