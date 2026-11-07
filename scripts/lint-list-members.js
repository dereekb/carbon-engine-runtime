// A `@type.list` member keeps its list for life. Replacing a BlueList with an array
// makes a later copy of the object return null (Copier refuses a member that is a
// list on one side only), and it silently disconnects the owner from its events.
//
// Checked, per class, against the members that class declares:
//
//   reassigned  `this.list = ...` outside the constructor, on any `@type.list` member.
//   raw         `this.list.length = n` or `this.list[i] = item` on a member that starts
//               as a BlueList. JavaScript cannot catch either, so no event is sent.
//
// A plain array's `length` is left alone: it has no events to miss. Code that means to
// skip the events says so with `Array.prototype.push.call( list, item )`, which is not
// an assignment and is not counted. Carbon's std containers are `@type.array`, and do not
// reach this lint at all.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";

const traverse = traverseModule.default ?? traverseModule;

const isTypeList = decorator =>
{
    const expression = decorator.expression;
    const callee = expression.type === "CallExpression" ? expression.callee : expression;
    return callee.type === "MemberExpression" && callee.object.name === "type" && callee.property.name === "list";
};

/** The `@type.list` members a class body declares, and which of them start as a BlueList. */
function listMembers(classBody)
{
    const all = new Set(), native = new Set();
    for (const member of classBody.body)
    {
        if (member.type !== "ClassProperty" || member.static || member.computed) continue;
        if (!(member.decorators ?? []).some(isTypeList)) continue;

        all.add(member.key.name);
        if (member.value?.type === "NewExpression" && member.value.callee.name === "BlueList") native.add(member.key.name);
    }
    return { all, native };
}

/** The member name when `node` is `this.name`, otherwise null. */
const thisMember = node => node?.type === "MemberExpression" && node.object.type === "ThisExpression" && !node.computed
    ? node.property.name : null;

/**
 * @param {string} source Module source.
 * @param {string} filename Reported file name.
 * @returns {{file: string, line: number, kind: string, member: string}[]} Sites that break the rule.
 */
export function findListMemberHits(source, filename)
{
    const ast = parse(source, { sourceType: "module", plugins: [ "decorators", "classProperties", "classPrivateMethods", "classPrivateProperties" ] });
    const hits = [];

    traverse(ast, {
        AssignmentExpression(p)
        {
            const classPath = p.findParent(parent => parent.isClass());
            if (!classPath) return;
            const { all, native } = listMembers(classPath.node.body);

            const left = p.node.left, line = left.loc.start.line;
            const direct = thisMember(left);
            if (direct !== null)
            {
                const inConstructor = p.findParent(parent => parent.isClassMethod({ kind: "constructor" }));
                if (all.has(direct) && !inConstructor) hits.push({ file: filename, line, kind: "reassigned", member: direct });
                return;
            }

            if (left.type !== "MemberExpression") return;
            const base = thisMember(left.object);
            if (base === null || !native.has(base)) return;
            if (left.computed || left.property.name === "length") hits.push({ file: filename, line, kind: "raw", member: base });
        }
    });
    return hits;
}

function scan(directory)
{
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
    {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) return [ "dropped", "generated" ].includes(entry.name) ? [] : scan(file);
        if (!file.endsWith(".js")) return [];

        const source = fs.readFileSync(file, "utf8");
        return source.includes("@type.list") ? findListMemberHits(source, file) : [];
    });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
{
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const hits = scan(path.join(root, "src"));
    for (const hit of hits) console.error(`${path.relative(root, hit.file)}:${hit.line}: ${hit.kind} list member ${hit.member}`);
    console.log(`list-members lint hits: ${hits.length}`);
    if (hits.length) process.exitCode = 1;
}
