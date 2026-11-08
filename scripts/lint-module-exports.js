// Two module-surface rules for `src`, both enforced at zero (no baseline).
//
// 1. NO DEFAULT EXPORTS. A class is exported by its name, once. A default
//    beside the named export gave every module two spellings of the same class
//    (`import X from` and `import { X } from`), and barrels re-exported the
//    default as well. 176 such files and 43 barrels were cleaned on 2026-11-03.
//    `export default`, `export { X as default }` and `export { default } from`
//    are all a default export.
//
// 2. NO UNUSED `be` IMPORT. `import { exposure as be } from "#be"` with no use
//    of `be` is dead code that also makes the file look Blue-exposed. 65 were
//    removed the same day. `be` is too short to grep for, so the check is
//    Babel's scope analysis: the import binding must have a reference
//    (decorator, call such as `be.inherit(X)(Cls)`, member access, re-export).
//    A shadowing local does not count as a use of the import.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";
import { UNSHIPPED_SOURCE_DIRS } from "./lib/unshipped-source.js";

const traverse = traverseModule.default ?? traverseModule;

/**
 * Finds the default exports and unused `be` imports in one module source.
 *
 * @param {string} source JavaScript module source.
 * @param {string} [filename="input.js"] For parse errors and reports.
 * @returns {Array<{file: string, line: number, rule: string, text: string}>} The hits, in source order.
 */
export function findModuleExportHits(source, filename = "input.js")
{
    const hits = [];
    const hit = (node, rule) => hits.push({ file: filename, line: node.loc.start.line, rule,
        text: source.slice(node.start, node.end).split("\n")[0] });
    const exportedName = specifier => specifier.exported?.name ?? specifier.exported?.value;
    const ast = parse(source, { sourceType: "module", plugins: [ "decorators", "importAttributes" ], sourceFilename: filename });
    traverse(ast, {
        ExportDefaultDeclaration(p)
        {
            hit(p.node, "default-export");
        },
        ExportNamedDeclaration(p)
        {
            if (p.node.specifiers.some(specifier => exportedName(specifier) === "default")) hit(p.node, "default-export");
        },
        ImportDeclaration(p)
        {
            if (p.node.source.value !== "#be") return;
            for (const specifier of p.node.specifiers)
            {
                if (specifier.local.name !== "be") continue;
                if (!p.scope.getBinding("be").referenced) hit(p.node, "unused-be-import");
            }
        }
    });
    return hits;
}

function scan(directory)
{
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
    {
        const file = path.join(directory, entry.name);
        return entry.isDirectory() && !UNSHIPPED_SOURCE_DIRS.has(entry.name) ? scan(file) : file.endsWith(".js")
            ? findModuleExportHits(fs.readFileSync(file, "utf8"), file) : [];
    });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
{
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const hits = scan(path.join(root, "src"));
    for (const hit of hits) console.error(`${path.relative(root, hit.file)}:${hit.line} ${hit.rule}: ${hit.text}`);
    console.log(`module-exports lint hits: ${hits.length} (default exports: export the class by name only; unused be imports: delete the import)`);
    if (hits.length) process.exitCode = 1;
}
