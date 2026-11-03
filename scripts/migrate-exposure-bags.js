// Rewrites a Carbon class's per-member exposure decorators as one `be.define` bag in Carbon's order (decorator-upgrade.md
// § 000a). Run by hand; not part of the build.
//
//   node scripts/migrate-exposure-bags.js --path src/trinity/eve/attachment [--dry-run] [--report out.json] [--exclude a.js,dir/]
//
// For each class declared `@be.define("Name")` under the path, it reads the class's `be.inherit`, `be.mapInterface`,
// `be.exposureChainTo` and `be.map*` decorators (on members, and above the class for inherited members), pairs every Carbon
// exposure row (tools-core's carbon-blue report, as lint-exposure-bags reads it) with the JS row of the same macro family and
// exposed name, and emits the bag: Carbon's interfaces, rows and chain, written with the JS identifiers, flags, choosers and keys
// the decorators already carried. It deletes the replaced decorator lines and leaves everything else on the members.
//
// It never guesses. A Carbon row with no JS row, a JS row with no Carbon row, a macro or flag difference, a macro with no bag
// kind, an interface or chain mismatch, or anything it cannot read leaves the class unmigrated and is reported. A rewritten
// class must also pass lint-exposure-bags with no findings, or it is left as it was. Our own classes (`meta.define`) and
// src/blue are out of scope.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";
import { filesUnder } from "./lib/carbon-source-index.js";
import { EDIT_FLAGS, carbonRow, compareBag, readBags } from "./lint-exposure-bags.js";

const traverse = traverseModule.default ?? traverseModule;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultReports = path.resolve(root, "..", "tools-core", "scripts", "carbon-blue", "reports");
const REPORT_FILES = [ "latest.json", "trinity-root-latest.json" ];

/** The bag row kind and method mode each `be.map*` decorator writes, and where its exposed name sits among its arguments. */
const MAP_DECORATORS = {
    mapAttribute: { family: "ATTR", kind: "ATTR", name: 1 },
    mapAttributeWithChooser: { family: "ATTR", kind: "ATTR_CHOOSER", name: 2 },
    mapAttribute__Index: { family: "ATTR", kind: "ATTR_INDEX", name: 1 },
    mapProperty: { family: "PROP", kind: "PROP", name: 0 },
    mapPropertyReadOnly: { family: "PROP", kind: "PROP_RO", name: 0 },
    mapPropertyPersisted: { family: "PROP", kind: "PROP_PERSISTED", name: 0 },
    mapProperty__Field: { family: "PROP", kind: "PROP", name: 0 },
    mapPropertyReadOnly__Field: { family: "PROP", kind: "PROP_RO", name: 0 },
    mapPropertyPersisted__Field: { family: "PROP", kind: "PROP_PERSISTED", name: 0 },
    mapMethod: { family: "METHOD", kind: "METHOD", mode: null, name: 0 },
    mapMethodAndWrap: { family: "METHOD", kind: "METHOD", mode: "WRAP", name: 0 },
    mapMethodAndWrapOptionalArgs: { family: "METHOD", kind: "METHOD", mode: "WRAP_OPTIONAL_ARGS", name: 0 },
    mapMethodAsMethod: { family: "METHOD", kind: "METHOD", mode: "AS_METHOD", name: 0 },
    mapICacheableMethods: { family: "ICACHEABLE", kind: "ICACHEABLE_METHODS", name: null }
};
const CLASS_DECORATORS = new Set([ "define", "inherit", "mapInterface", "exposureChainTo", ...Object.keys(MAP_DECORATORS) ]);

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
{
    main(process.argv.slice(2));
}

function main(argv)
{
    const option = name => { const index = argv.indexOf(name); return index === -1 ? undefined : argv[index + 1]; };
    const scope = option("--path");
    if (!scope) throw new Error("Pass --path <directory under runtime>, e.g. src/trinity/eve/attachment.");
    const dryRun = argv.includes("--dry-run");
    // Files someone else is changing: comma-separated paths or directory prefixes under runtime.
    const excluded = (option("--exclude") ?? "").split(",").map(entry => entry.trim().replace(/\\/g, "/")).filter(Boolean);
    const reportRoot = path.resolve(option("--reports") ?? process.env.CARBON_BLUE_REPORTS ?? defaultReports);
    const carbon = readCarbon(REPORT_FILES.map(file => path.join(reportRoot, file)).filter(file => fs.existsSync(file))
        .map(file => JSON.parse(fs.readFileSync(file, "utf8"))));
    if (!carbon.size) throw new Error(`No carbon-blue report in ${reportRoot}.`);

    const results = [];
    const directory = path.resolve(root, scope);
    const files = fs.statSync(directory).isDirectory() ? filesUnderSync(directory) : [ directory ];
    for (const file of files)
    {
        const relative = path.relative(root, file).split(path.sep).join("/");
        if (relative.startsWith("src/blue/") || excluded.some(prefix => relative.startsWith(prefix))) continue;
        const source = fs.readFileSync(file, "utf8");
        if (!/@be\.define\(\s*"/.test(source)) continue;
        const { output, classes } = migrateSource(source, relative, carbon);
        results.push(...classes);
        if (!dryRun && output !== source) fs.writeFileSync(file, output);
    }

    for (const result of results)
    {
        console.log(`${result.migrated ? "migrated" : "skipped "} ${result.class} (${result.file})`);
        for (const reason of result.unresolved) console.log(`    ${reason}`);
    }
    const migrated = results.filter(result => result.migrated).length;
    console.log(`${dryRun ? "Dry run: " : ""}${migrated} migrated, ${results.length - migrated} skipped, under ${scope}.`);
    const out = option("--report");
    if (out) fs.writeFileSync(out, JSON.stringify(results, null, 2) + "\n");
}

function filesUnderSync(directory)
{
    const files = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }))
    {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...filesUnderSync(target));
        else if (entry.name.endsWith(".js")) files.push(target);
    }
    return files.sort();
}

/**
 * Carbon's exposure per class: its rows in source order and its EXPOSURE_BEGIN, the first report holding one winning.
 *
 * @param {object[]} reports carbon-blue reports.
 * @returns {Map<string, {rows: object[], exposure: object}>} Each exposed class.
 */
export function readCarbon(reports)
{
    const carbon = new Map();
    for (const report of reports)
        for (const record of report.classes)
            if (record.blue?.exposures?.length && !carbon.has(record.name))
                carbon.set(record.name, { rows: record.blue.rows, exposure: record.blue.exposures[0] });
    return carbon;
}

/**
 * Migrates every `@be.define("Name")` class in one module.
 *
 * @param {string} source The module source.
 * @param {string} file Its path, for the report.
 * @param {Map<string, {rows: object[], exposure: object}>} carbon From readCarbon.
 * @returns {{output: string, classes: Array<{class: string, file: string, migrated: boolean, unresolved: string[]}>}} The new source and the per-class plan.
 */
export function migrateSource(source, file, carbon)
{
    const ast = parse(source, { sourceType: "module", plugins: [ "decorators" ], sourceFilename: file });
    const classes = [];
    const edits = [];
    const visit = classPath =>
    {
        const plan = planClass(classPath.node, source, carbon);
        if (!plan) return;
        let classEdits = plan.edits;
        if (!plan.unresolved.length)
        {
            // The rewritten module must pass the bag lint for this class with nothing to report.
            const candidate = applyEdits(source, classEdits);
            const bag = readBags(candidate, file).find(entry => entry.name === plan.name);
            const findings = bag ? compareBag(bag, carbon.get(plan.name).rows) : [ { detail: "the bag was not written" } ];
            for (const finding of findings) plan.unresolved.push(`after rewriting, lint-exposure-bags: ${finding.detail}`);
        }
        if (plan.unresolved.length) classEdits = [];
        edits.push(...classEdits);
        classes.push({ class: plan.name, file, migrated: !plan.unresolved.length, unresolved: plan.unresolved });
    };
    traverse(ast, { ClassDeclaration: visit, ClassExpression: visit });
    return { output: applyEdits(source, edits), classes };
}

function applyEdits(source, edits)
{
    let output = source;
    for (const edit of edits.slice().sort((a, b) => b.start - a.start)) output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
    return output;
}

/** The plan for one class, or null when it is not a `@be.define("Name")` class. */
function planClass(node, source, carbon)
{
    const decorators = node.decorators ?? [];
    const define = decorators.find(d => beCall(d) === "define");
    if (!define || define.expression.arguments[0]?.type !== "StringLiteral") return null;
    const name = define.expression.arguments[0].value;
    const unresolved = [];
    const text = n => source.slice(n.start, n.end);
    const entry = carbon.get(name);
    if (!entry) return { name, unresolved: [ `Carbon has no EXPOSURE_BEGIN( ${name} ) in the scanned _Blue.cpp files` ], edits: [] };

    const removed = [];
    const inherit = [], interfaces = [], jsRows = [];
    let chainTo = null;
    for (const d of decorators)
    {
        const fn = beCall(d);
        if (!fn) continue;
        if (!CLASS_DECORATORS.has(fn)) { unresolved.push(`class decorator be.${fn} is not part of a bag`); continue; }
        const args = d.expression.arguments;
        if (fn !== "define") removed.push(d);
        if (fn === "inherit") inherit.push(...args.map(text));
        else if (fn === "mapInterface") for (const arg of args.flatMap(a => a.type === "ArrayExpression" ? a.elements : [ a ])) interfaces.push({ name: referenceName(arg), text: text(arg) });
        else if (fn === "exposureChainTo") chainTo = { name: referenceName(args[0]), text: text(args[0]) };
        else if (MAP_DECORATORS[fn])
        {
            // Above the class: the row names a member the class inherits, so its key is the exposed name.
            const spec = MAP_DECORATORS[fn];
            if (spec.family === "ICACHEABLE") { jsRows.push({ ...spec, exposed: null, key: null, decorator: d }); continue; }
            const nameArg = args[spec.name];
            const names = nameArg?.type === "ArrayExpression" ? nameArg.elements : [ nameArg ];
            for (const n of names)
            {
                if (n?.type !== "StringLiteral") { unresolved.push(`class-level be.${fn} has a name that is not a string literal`); continue; }
                jsRows.push(rowFrom(spec, args, n.value, n.value, d, text));
            }
        }
    }

    for (const member of node.body.body)
    {
        for (const d of member.decorators ?? [])
        {
            const fn = beCall(d);
            if (!fn || !fn.startsWith("map")) continue;
            const spec = MAP_DECORATORS[fn];
            if (!spec || spec.family === "ICACHEABLE") { unresolved.push(`member decorator be.${fn} has no bag row`); continue; }
            const key = memberKey(member);
            if (key === null) { unresolved.push(`be.${fn} on a member whose key is not a plain name`); continue; }
            const nameArg = d.expression.arguments[spec.name];
            if (nameArg && nameArg.type !== "StringLiteral") { unresolved.push(`be.${fn} on ${key}: the exposed name is not a string literal`); continue; }
            jsRows.push(rowFrom(spec, d.expression.arguments, nameArg ? nameArg.value : key, key, d, text));
            removed.push(d);
        }
    }

    // Carbon's member rows, each paired with the JS row of its family and exposed name.
    const bagRows = [];
    const unpaired = jsRows.slice();
    for (const row of entry.rows)
    {
        if (![ "ATTR", "PROP", "METHOD", "ICACHEABLE" ].includes(row.kind)) continue;
        const expected = carbonRow(row);
        const where = `${row.source}:${row.line}`;
        const index = unpaired.findIndex(js => js.family === expected.family && js.exposed === expected.name);
        if (index === -1) { unresolved.push(`Carbon row with no JS member: ${row.macro} "${row.name ?? ""}" (${where})`); continue; }
        const [ js ] = unpaired.splice(index, 1);
        if (expected.kind === null) { unresolved.push(`no bag kind: ${row.macro} "${row.name}" (${where})`); continue; }
        if (expected.kind !== js.kind || (expected.mode ?? null) !== (js.mode ?? null))
        {
            const carbonKind = `${expected.kind}${expected.mode ? ` ${expected.mode}` : ""}`, jsKind = `${js.kind}${js.mode ? ` ${js.mode}` : ""}`;
            unresolved.push(`macro differs for "${row.name}": Carbon ${row.macro} ${row.member ?? ""} is ${carbonKind} (${where}); JS be.${js.fn} is ${jsKind}`);
            continue;
        }
        if (expected.flags !== undefined && js.flagsValue !== expected.flags)
        {
            unresolved.push(`flags differ for "${row.name}": Carbon ${row.flags.join(" | ")} (${where}), JS ${js.flagsText ?? "none"}`);
            continue;
        }
        bagRows.push(js);
    }
    for (const js of unpaired) unresolved.push(`JS row with no Carbon row: be.${js.fn} "${js.exposed ?? ""}" on ${js.key ?? "the class"}`);

    // Interfaces, in Carbon's order with the JS identifiers; the class's own MAP_INTERFACE is implied by the bag.
    const carbonInterfaces = entry.rows.filter(row => row.kind === "INTERFACE" && row.name !== name);
    const jsInterfaces = interfaces.filter(i => i.name !== name);
    const orderedInterfaces = [];
    for (const row of carbonInterfaces)
    {
        const js = jsInterfaces.find(i => i.name === row.name);
        if (!js) unresolved.push(`Carbon maps interface ${row.name} (${row.source}:${row.line}); the class does not`);
        else orderedInterfaces.push(js.text);
    }
    for (const js of jsInterfaces) if (!carbonInterfaces.some(row => row.name === js.name)) unresolved.push(`the class maps interface ${js.name}; Carbon does not`);
    const carbonChain = entry.rows.find(row => row.kind === "CHAINTO");
    if ((carbonChain?.name ?? null) !== (chainTo?.name ?? null))
        unresolved.push(`chainTo differs: Carbon ${carbonChain ? carbonChain.name : "none"}, JS ${chainTo ? chainTo.name : "none"}`);

    if (unresolved.length) return { name, unresolved, edits: [] };

    const lines = entry.rows.filter(row => row.kind !== "FUNCTION").map(row => row.line).concat(entry.exposure.line);
    const cite = `${path.basename(entry.exposure.source)}:${Math.min(...lines)}-${Math.max(...lines)}`;
    const bag = renderBag({ name, inherit, cite, interfaces: orderedInterfaces, rows: bagRows, chainTo: chainTo?.text ?? null });
    const edits = [ { start: define.start, end: define.end, text: bag } ];
    for (const d of new Set(removed)) edits.push(removal(source, d));
    return { name, unresolved, edits };
}

function rowFrom(spec, args, exposed, key, decorator, text)
{
    const flagsArg = spec.family === "ATTR" ? args[0] : undefined;
    return {
        ...spec, fn: beCall(decorator), exposed, key, decorator,
        flagsText: flagsArg ? text(flagsArg) : undefined,
        flagsValue: flagsArg ? flagValue(flagsArg) : undefined,
        chooserText: spec.kind === "ATTR_CHOOSER" && args[1] ? text(args[1]) : undefined,
        indexText: spec.kind === "ATTR_INDEX" && args[2] ? text(args[2]) : undefined
    };
}

function renderBag({ name, inherit, cite, interfaces, rows, chainTo })
{
    const out = [ "@be.define({", `  name: ${JSON.stringify(name)},` ];
    if (inherit.length) out.push(`  inherit: [ ${inherit.join(", ")} ],`);
    out.push(`  // ${cite}, in Carbon's order.`);
    if (interfaces.length) out.push(`  interfaces: [ ${interfaces.join(", ")} ],`);
    const rendered = rows.map(renderRow);
    out.push(rendered.length ? `  members: [\n${rendered.map(row => `    ${row}`).join(",\n")}\n  ]${chainTo ? "," : ""}` : `  members: []${chainTo ? "," : ""}`);
    if (chainTo) out.push(`  chainTo: ${chainTo}`);
    out.push("})");
    return out.join("\n");
}

function renderRow(row)
{
    const name = JSON.stringify(row.exposed);
    const key = row.key !== row.exposed ? JSON.stringify(row.key) : null;
    switch (row.kind)
    {
        case "ICACHEABLE_METHODS": return "[ be.ICACHEABLE_METHODS ]";
        case "ATTR": return `[ be.ATTR, ${name}, ${row.flagsText}${key ? `, ${key}` : ""} ]`;
        case "ATTR_CHOOSER": return `[ be.ATTR_CHOOSER, ${name}, ${row.flagsText}, ${row.chooserText}${key ? `, ${key}` : ""} ]`;
        case "ATTR_INDEX": return `[ be.ATTR_INDEX, ${name}, ${row.flagsText}, ${row.indexText}, ${JSON.stringify(row.key)} ]`;
        case "METHOD":
        {
            const mode = row.mode ? `, be.${row.mode}` : key ? ", undefined" : "";
            return `[ be.METHOD, ${name}${mode}${key ? `, ${key}` : ""} ]`;
        }
        default: return `[ be.${row.kind}, ${name}${key ? `, ${key}` : ""} ]`;
    }
}

/** The range that deletes one decorator: its whole line when nothing else is on it, else the decorator and the space after it. */
function removal(source, d)
{
    const lineStart = source.lastIndexOf("\n", d.start - 1) + 1;
    let lineEnd = source.indexOf("\n", d.end);
    if (lineEnd === -1) lineEnd = source.length;
    const before = source.slice(lineStart, d.start), after = source.slice(d.end, lineEnd);
    if (!before.trim() && !after.trim())
    {
        // A decorator line between a blank line (or the opening brace) and another blank line takes the second blank with it.
        let end = Math.min(lineEnd + 1, source.length);
        const previousLine = source.slice(source.lastIndexOf("\n", lineStart - 2) + 1, Math.max(lineStart - 1, 0)).trim();
        const next = /^[ \t]*\r?\n/.exec(source.slice(end));
        if (next && (previousLine === "" || previousLine.endsWith("{"))) end += next[0].length;
        return { start: lineStart, end, text: "" };
    }
    const trailing = /^[ \t]*/.exec(after)[0].length;
    return { start: d.start, end: d.end + trailing, text: "" };
}

function beCall(d)
{
    const callee = d.expression.type === "CallExpression" ? d.expression.callee : null;
    return callee && callee.type === "MemberExpression" && callee.object.type === "Identifier" && callee.object.name === "be"
        && callee.property.type === "Identifier" ? callee.property.name : null;
}


function memberKey(member)
{
    if (member.computed) return null;
    if (member.key.type === "Identifier") return member.key.name;
    if (member.key.type === "StringLiteral") return member.key.value;
    return null;
}

function referenceName(node)
{
    if (!node) return null;
    if (node.type === "Identifier") return node.name;
    if (node.type === "MemberExpression" && node.property.type === "Identifier") return node.property.name;
    return null;
}

function flagValue(node)
{
    if (node.type === "NumericLiteral") return node.value;
    if (node.type === "MemberExpression" && node.object.name === "be" && node.property.name in EDIT_FLAGS) return EDIT_FLAGS[node.property.name];
    if (node.type === "BinaryExpression" && node.operator === "|")
    {
        const left = flagValue(node.left), right = flagValue(node.right);
        return left === null || right === null ? null : left | right;
    }
    return null;
}
