// Exposure-bag parity: every `@be.define({ name, interfaces, members, chainTo })`
// bag (decorator-upgrade.md § 000a) against the exposure block Carbon writes
// for that class, row by row.
//
// WHERE CARBON'S ROWS COME FROM. tools-core's carbon-blue scanner reads every
// _Blue.cpp and records each class's exposure macros in source order
// (`blue.rows`). Its reports are scan output, not source, so they are
// gitignored; this lint reads them from the sibling tools-core checkout, or
// from CARBON_BLUE_REPORTS, the way lint-native-method-parity reads
// tools-core's schema build. With no report it SKIPS and says how to make one,
// like the lints that read CARBON_ROOT. Its tests use fixtures and never need
// Carbon.
//
// WHAT IS COMPARED, per bag:
// - the bag's name names a Carbon exposure block;
// - each member row's kind (macro, method mode included), exposed name and
//   flags (as Carbon's EDITFLAGS values, so READ | WRITE is READWRITE);
// - the JS key a row lands on: for an attribute, Carbon's member without m_,
//   or `_` plus it for a member the class keeps private; for a method,
//   Carbon's C++ method name, or an overload variant of it (`Name__Suffix`).
//   A property is checked by exposed name only: it sits on an accessor or on
//   the plain field that stores it under that name;
// - the order of the member rows;
// - interfaces and chainTo, as sets. Carbon's MAP_INTERFACE of the class
//   itself is implied by the bag and not listed in it.
// MAP_FUNCTION rows are skipped: they register module functions
// (BlueRegistration.h:226-230), not members of the enclosing class.
//
// Classes with no bag are not read. Findings are a shrink-only baseline
// (exposure-bag-baseline.json): a new one fails, and one that is fixed must be
// written out with --write.

import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";
import { baselineProblems, filesUnder } from "./lib/carbon-source-index.js";

const traverse = traverseModule.default ?? traverseModule;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = path.join(root, "scripts", "exposure-bag-baseline.json");
const defaultReports = path.resolve(root, "..", "tools-core", "scripts", "carbon-blue", "reports");
const REPORT_FILES = [ "latest.json", "trinity-root-latest.json" ];

/** Carbon's EDITFLAGS (blueexposure/include/BlueTypes.h:283-311). */
export const EDIT_FLAGS = {
    NONE: 0x000, READ: 0x001, WRITE: 0x002, READWRITE: 0x003, NOTIFY: 0x004, HIDDEN: 0x008, MODMASK: 0x00F,
    PERSIST: 0x010, RPERSIST: 0x020, SERMASK: 0x0F0, FLAGS: 0x100, ENUM: 0x200, EDMASK: 0xF00, PERSISTONLY: 0x018
};

/** The bag's row kinds and method modes, by the `be` constant a row is written with. */
const ROW_KINDS = new Set([ "ATTR", "ATTR_CHOOSER", "ATTR_INDEX", "PROP", "PROP_RO", "PROP_PERSISTED", "METHOD", "ICACHEABLE_METHODS" ]);
const METHOD_MODES = { WRAP: "MAP_METHOD_AND_WRAP", WRAP_OPTIONAL_ARGS: "MAP_METHOD_AND_WRAP_OPTIONAL_ARGS", AS_METHOD: "MAP_METHOD_AS_METHOD" };
const PROPERTY_MACROS = { PROP: "MAP_PROPERTY", PROP_RO: "MAP_PROPERTY_READONLY", PROP_PERSISTED: "MAP_PROPERTY_PERSISTED" };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
{
    await main();
}

async function main()
{
    const reportRoot = path.resolve(process.env.CARBON_BLUE_REPORTS ?? defaultReports);
    const reports = REPORT_FILES.map(file => path.join(reportRoot, file)).filter(file => existsSync(file));
    if (!reports.length)
    {
        console.log(`Exposure bags SKIPPED: no carbon-blue report in ${reportRoot}. Run \`npm run scan\` and \`npm run scan:trinity\` `
            + "in tools-core against a Carbon checkout, or set CARBON_BLUE_REPORTS.");
        return;
    }
    const carbon = readCarbonExposures(reports.map(file => JSON.parse(readFileSync(file, "utf8"))));

    const findings = new Map();
    let bagCount = 0;
    for (const file of await filesUnder(path.join(root, "src"), [ ".js" ]))
    {
        const source = await readFile(file, "utf8");
        if (!source.includes("be.define")) continue;
        for (const bag of readBags(source, file))
        {
            bagCount++;
            for (const finding of compareBag(bag, carbon.get(bag.name)))
                findings.set(`${bag.name}#${finding.key}`, finding.detail);
        }
    }

    const passed = await baselineProblems(findings, baselinePath, process.argv.includes("--write"));
    console.log(`Exposure bags: ${bagCount} bag(s) against Carbon's exposure blocks, ${findings.size} finding(s) recorded.`);
    if (!passed) process.exitCode = 1;
}

/**
 * Carbon's exposure block per class from carbon-blue reports: the record holding the class's EXPOSURE_BEGIN, the first report
 * that has one winning (the full scan before the trinity-root scan).
 *
 * @param {object[]} reports carbon-blue reports.
 * @returns {Map<string, object[]>} Each exposed class's rows, in Carbon's source order.
 */
export function readCarbonExposures(reports)
{
    const exposures = new Map();
    for (const report of reports)
    {
        for (const record of report.classes)
        {
            const blue = record.blue;
            if (!blue || !blue.exposures || !blue.exposures.length || exposures.has(record.name)) continue;
            if (!Array.isArray(blue.rows)) throw new Error(`carbon-blue report predates exposure rows (${record.name}): regenerate it in tools-core.`);
            exposures.set(record.name, blue.rows);
        }
    }
    return exposures;
}

/**
 * The `be.define` exposure bags written in one source file.
 *
 * @param {string} source The module source.
 * @param {string} [file] Its path, for messages.
 * @returns {Array<{name: string, file: string, line: number, interfaces: string[], chainTo: string|null, members: object[], problems: string[]}>}
 *   Each bag, its rows read from the AST.
 */
export function readBags(source, file = "input.js")
{
    const ast = parse(source, { sourceType: "module", plugins: [ "decorators" ], sourceFilename: file });
    const bags = [];
    const visit = classPath =>
    {
        for (const decorator of classPath.node.decorators ?? [])
        {
            const call = decorator.expression;
            if (call.type !== "CallExpression" || !isMember(call.callee, "be", "define")) continue;
            const argument = call.arguments[0];
            if (!argument || argument.type !== "ObjectExpression" || !property(argument, "name")) continue;
            bags.push(readBag(argument, file));
        }
    };
    traverse(ast, { ClassDeclaration: visit, ClassExpression: visit });
    return bags;
}

function readBag(node, file)
{
    const problems = [];
    const nameNode = property(node, "name");
    const name = nameNode.type === "StringLiteral" ? nameNode.value : null;
    if (name === null) problems.push("name: not a string literal");
    const interfaces = (property(node, "interfaces")?.elements ?? []).map(element => referenceName(element));
    const chainToNode = property(node, "chainTo");
    const members = [];
    for (const [ index, rowNode ] of (property(node, "members")?.elements ?? []).entries())
    {
        const row = readRow(rowNode);
        if (typeof row === "string") problems.push(`row ${index}: ${row}`);
        else members.push(row);
    }
    return { name, file, line: node.loc.start.line, interfaces, chainTo: chainToNode ? referenceName(chainToNode) : null, members, problems };
}

/** One member row as `{ kind, name, flags?, mode?, key }`, or a string saying why it cannot be read. */
function readRow(node)
{
    if (!node || node.type !== "ArrayExpression") return "not an array";
    const [ kindNode, nameNode, ...rest ] = node.elements;
    const kind = kindNode && kindNode.type === "MemberExpression" && isMember(kindNode, "be") ? kindNode.property.name : null;
    if (!ROW_KINDS.has(kind)) return "kind is not a be row constant";
    if (kind === "ICACHEABLE_METHODS") return { kind, name: null, key: null };
    if (!nameNode || nameNode.type !== "StringLiteral") return "name is not a string literal";
    const name = nameNode.value;
    const literal = value => value && value.type === "StringLiteral" ? value.value : undefined;
    switch (kind)
    {
        case "ATTR":
            return { kind, name, flags: flagValue(rest[0]), key: literal(rest[1]) ?? name };
        case "ATTR_CHOOSER":
            return { kind, name, flags: flagValue(rest[0]), key: literal(rest[2]) ?? name };
        case "ATTR_INDEX":
            return { kind, name, flags: flagValue(rest[0]), key: literal(rest[2]) ?? null };
        case "METHOD":
        {
            // No mode, or `undefined` before an explicit method, is plain MAP_METHOD.
            const noMode = !rest[0] || (rest[0].type === "Identifier" && rest[0].name === "undefined");
            const mode = !noMode && isMember(rest[0], "be") ? rest[0].property.name : null;
            if (!noMode && !(mode in METHOD_MODES)) return "method mode is not a be mode constant";
            return { kind, name, mode, key: literal(rest[1]) ?? name };
        }
        default:
            return { kind, name, key: literal(rest[0]) ?? name };
    }
}

/** A flag expression of `be.X` constants, `|` and numbers, as a number; null when it is anything else. */
function flagValue(node)
{
    if (!node) return null;
    if (node.type === "NumericLiteral") return node.value;
    if (node.type === "MemberExpression" && isMember(node, "be") && node.property.name in EDIT_FLAGS) return EDIT_FLAGS[node.property.name];
    if (node.type === "BinaryExpression" && node.operator === "|")
    {
        const left = flagValue(node.left), right = flagValue(node.right);
        return left === null || right === null ? null : left | right;
    }
    return null;
}

/**
 * The findings for one bag against Carbon's rows for the class.
 *
 * @param {{name: string, interfaces: string[], chainTo: string|null, members: object[], problems: string[]}} bag A bag from readBags.
 * @param {object[]|undefined} rows Carbon's rows for the class (readCarbonExposures), or undefined when Carbon exposes no such class.
 * @returns {Array<{key: string, detail: string}>} Each difference: `key` is stable across Carbon line moves, `detail` cites the line.
 */
export function compareBag(bag, rows)
{
    const findings = bag.problems.map(problem => ({ key: `unreadable ${problem}`, detail: `the bag cannot be read: ${problem}` }));
    if (!rows)
    {
        findings.push({ key: "no Carbon exposure", detail: `Carbon has no EXPOSURE_BEGIN( ${bag.name} ) in the scanned _Blue.cpp files.` });
        return findings;
    }
    const at = row => `${row.source}:${row.line}${row.condition ? ` (under #if ${row.condition})` : ""}`;

    // Interfaces and chainTo, as sets.
    const carbonInterfaces = rows.filter(row => row.kind === "INTERFACE" && row.name !== bag.name);
    for (const row of carbonInterfaces)
        if (!bag.interfaces.includes(row.name)) findings.push({ key: `interface ${row.name} missing`, detail: `Carbon maps ${row.name} (${at(row)}); the bag does not.` });
    for (const name of bag.interfaces)
        if (!carbonInterfaces.some(row => row.name === name)) findings.push({ key: `interface ${name} extra`, detail: `the bag lists ${name}; Carbon does not map it.` });
    const chain = rows.filter(row => row.kind === "CHAINTO");
    for (const row of chain)
        if (bag.chainTo !== row.name) findings.push({ key: `chainTo ${row.name} missing`, detail: `Carbon chains to ${row.name} (${at(row)}); the bag ${bag.chainTo ? `chains to ${bag.chainTo}` : "has no chainTo"}.` });
    if (bag.chainTo && !chain.some(row => row.name === bag.chainTo))
        findings.push({ key: `chainTo ${bag.chainTo} extra`, detail: `the bag chains to ${bag.chainTo}; Carbon does not.` });

    // Member rows, paired by family and exposed name, in order of occurrence.
    const carbonMembers = rows.filter(row => [ "ATTR", "PROP", "METHOD", "ICACHEABLE" ].includes(row.kind)).map(row => ({ ...carbonRow(row), row }));
    const unpaired = carbonMembers.slice();
    const pairs = [];
    for (const member of bag.members)
    {
        const index = unpaired.findIndex(carbon => carbon.family === family(member.kind) && carbon.name === member.name);
        if (index === -1)
        {
            findings.push({ key: `${label(member)} extra`, detail: `the bag maps ${label(member)}; Carbon's block for ${bag.name} does not.` });
            continue;
        }
        const [ carbon ] = unpaired.splice(index, 1);
        pairs.push({ member, carbon });
    }
    for (const carbon of unpaired)
        findings.push({ key: `${carbon.label} missing`, detail: `Carbon maps ${carbon.label} (${at(carbon.row)}); the bag does not.` });

    for (const { member, carbon } of pairs)
    {
        const where = at(carbon.row);
        if (carbon.kind === null) findings.push({ key: `${carbon.label} no bag kind`, detail: `${carbon.row.macro} (${where}) has no bag row kind yet.` });
        else if (carbon.kind !== member.kind || (carbon.mode ?? null) !== (member.mode ?? null))
            findings.push({ key: `${carbon.label} kind`, detail: `Carbon writes ${carbon.row.macro} (${where}); the bag writes ${label(member)}.` });
        if (carbon.flags !== undefined && member.flags !== undefined && carbon.flags !== member.flags)
            findings.push({ key: `${carbon.label} flags`, detail: `Carbon's flags are ${carbon.row.flags.join(" | ")} (${where}); the bag's evaluate to ${member.flags === null ? "an expression it cannot read" : `0x${member.flags.toString(16)}`}.` });
        // An overload split (`Name__Discriminator`) carries the row on the variant the macro binds.
        const key = carbon.family === "METHOD" && member.key ? member.key.replace(/__\w+$/, "") : member.key;
        if (carbon.keys && !carbon.keys.includes(key))
            findings.push({ key: `${carbon.label} key`, detail: `${carbon.label} lands on "${member.key}"; Carbon's ${carbon.source} (${where}) gives ${carbon.keys.map(key => `"${key}"`).join(" or ")}.` });
    }

    // Order: the paired rows in the bag's order against Carbon's.
    const bagOrder = pairs.map(pair => pair.carbon);
    const carbonOrder = bagOrder.slice().sort((a, b) => a.row.order - b.row.order);
    const first = bagOrder.findIndex((carbon, index) => carbon !== carbonOrder[index]);
    if (first !== -1)
        findings.push({ key: "order", detail: `member ${first} is ${bagOrder[first].label}; Carbon writes ${carbonOrder[first].label} there (${at(carbonOrder[first].row)}).` });

    return findings;
}

/** A scanned Carbon row as the bag would write it: its family, bag kind (null when the bag has none), flags and acceptable JS keys. */
export function carbonRow(row)
{
    if (row.kind === "ICACHEABLE") return { family: "ICACHEABLE", kind: "ICACHEABLE_METHODS", name: null, label: "ICACHEABLE_METHODS" };
    if (row.kind === "PROP")
    {
        const kind = Object.keys(PROPERTY_MACROS).find(key => PROPERTY_MACROS[key] === row.macro) ?? null;
        return { family: "PROP", kind, name: row.name, label: `property ${row.name}` };
    }
    if (row.kind === "METHOD")
    {
        const mode = row.macro === "MAP_METHOD" ? null : Object.keys(METHOD_MODES).find(key => METHOD_MODES[key] === row.macro);
        const target = row.target ? row.target.split("::").pop() : null;
        return {
            family: "METHOD", kind: mode === undefined ? null : "METHOD", mode: mode ?? null, name: row.name, label: `method ${row.name}`,
            keys: target ? [ target ] : undefined, source: `method ${target}`
        };
    }
    const indexed = /\[/.test(row.member ?? "");
    const kind = row.macro === "MAP_ATTRIBUTE_WITH_CHOOSER" ? "ATTR_CHOOSER" : row.macro === "MAP_ATTRIBUTE" ? (indexed ? "ATTR_INDEX" : "ATTR") : null;
    const member = (row.member ?? "").replace(/\[.*$/, "").trim();
    const plain = /^m_(\w+)$/.exec(member);
    return {
        family: "ATTR", kind, name: row.name, label: `attribute ${row.name}`,
        flags: (row.flags ?? []).reduce((value, flag) => value | (EDIT_FLAGS[flag] ?? NaN), 0),
        keys: plain ? [ plain[1], `_${plain[1]}` ] : undefined, source: `member ${member}`
    };
}

function family(kind)
{
    if (kind.startsWith("ATTR")) return "ATTR";
    if (kind.startsWith("PROP")) return "PROP";
    return kind === "ICACHEABLE_METHODS" ? "ICACHEABLE" : kind;
}

function label(member)
{
    if (member.kind === "ICACHEABLE_METHODS") return "ICACHEABLE_METHODS";
    return `${{ ATTR: "attribute", PROP: "property", METHOD: "method" }[family(member.kind)]} ${member.name}`;
}

function isMember(node, object, name)
{
    return node.type === "MemberExpression" && node.object.type === "Identifier" && node.object.name === object
        && node.property.type === "Identifier" && (name === undefined || node.property.name === name);
}

function property(objectNode, name)
{
    const found = objectNode.properties.find(entry => entry.type === "ObjectProperty" && (entry.key.name ?? entry.key.value) === name);
    return found ? found.value : undefined;
}

function referenceName(node)
{
    if (node.type === "Identifier") return node.name;
    if (node.type === "MemberExpression" && node.property.type === "Identifier") return node.property.name;
    if (node.type === "StringLiteral") return node.value;
    return null;
}
