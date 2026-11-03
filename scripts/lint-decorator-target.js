import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inventoryRuntime } from "./lib/decorator-target-inventory.js";
import { checkAccessorBodies } from "./lib/carbon-accessor-bodies.js";

// Two checks against Carbon's headers and exposure blocks that no other lint makes:
//
// - carbon-origin-name: a method on a class with a Carbon identity that matches no method Carbon declares on that class or its
//   bases, and carries no @cjs. lint-native-method-parity checks the other direction (Carbon methods we lack).
// - property-field-body: a MAP_PROPERTY realised on a plain field (`be.mapProperty*__Field`, on the member or above the class)
//   is faithful only where Carbon's getter and setter just read and write one member (lib/carbon-accessor-bodies.js). Needs
//   CARBON_ROOT, since it reads the accessor bodies.
//
// Carbon's side comes from tools-core's carbon-blue reports (scripts/carbon-blue/reports, gitignored scan output), read from the
// sibling checkout or CARBON_BLUE_REPORTS; with none the audit skips. Its other rules, which checked the per-member exposure
// decorators and the marker states, were retired on 2026-11-03: lint-exposure-bags checks exposure, and lint-marker-tags the
// markers. The audit reports; it never fails a build.

const defaultReports = fileURLToPath(new URL("../../tools-core/scripts/carbon-blue/reports", import.meta.url));
const REPORT_FILES = [ "latest.json", "trinity-root-latest.json" ];
const PROPERTY_FIELD = /^exposure\.mapProperty(?:ReadOnly|Persisted)?__Field$/;

/**
 * Carbon's facts from carbon-blue reports: every header declaration's methods and bases, and each exposed class's MAP_PROPERTY
 * rows. A nested class is reported as `Outer.Inner`; it is also found as `Outer::Inner`.
 *
 * @param {object[]} reports carbon-blue reports, the full scan first.
 * @returns {{headers: Map<string, Array<{methods: string[], bases: string[]}>>, properties: Map<string, object[]>}} The facts.
 */
export function readCarbonReports(reports)
{
    const headers = new Map(), properties = new Map();
    for (const report of reports)
    {
        for (const record of report.classes)
        {
            for (const name of new Set([ record.name, record.name.replaceAll(".", "::") ]))
            {
                if (!headers.has(name)) headers.set(name, []);
                headers.get(name).push({ methods: (record.methods ?? []).map(method => method.name), bases: record.bases ?? [] });
                if (record.blue?.exposures?.length && !properties.has(name)) properties.set(name, record.blue.properties ?? []);
            }
        }
    }
    return { headers, properties };
}

/** Uses declared native identity, keeping own modelled-on donors distinct. */
function identity(c)
{
    const native = [];
    const carbonComments = (c.donorComments ?? []).filter(d => !d.error && d.kind === "Carbon").map(d => d.name);
    native.push(...carbonComments);
    const annotations = c.definitions.filter(d => d.kind === "meta.carbon");
    for (const d of c.definitions)
    {
        const v = d.value;
        if (d.kind === "meta.carbon") native.push(...(Array.isArray(v) ? v : [v]));
        else if (d.namespace === "blue" || d.namespace === "exposure")
            native.push(...(annotations.length || carbonComments.length ? [] : typeof v === "string" ? [v] : v?.carbon ? [].concat(v.carbon) : [v?.className ?? v?.name]));
        else if (v?.carbon) native.push(...[].concat(v.carbon));
    }
    return [ ...new Set(native.filter(x => typeof x === "string")) ];
}

/**
 * Compares a source inventory with Carbon's facts. Findings never fail a build.
 *
 * @param {{classes: object[], diagnostics: object[]}} inventory From inventoryRuntime.
 * @param {{headers: Map, properties: Map}} carbon From readCarbonReports.
 * @param {{accessorBodies?: boolean}} [options] Whether Carbon's source is there to read accessor bodies.
 * @returns {object[]} The findings.
 */
export function auditDecorators(inventory, carbon, { accessorBodies = false } = {})
{
    const findings = [];
    const add = (rule, c, m, detail, evidence) => findings.push({ rule, source: c.source, class: c.name,
        member: m?.name ?? "<class>", line: m?.line ?? c.line, detail, ...(evidence ? { evidence } : {}) });
    for (const c of inventory.classes)
    {
        if (c.dropped) continue;
        const native = identity(c);
        const searched = new Set(), nativeMethods = new Set();
        const queue = [ ...native ];
        while (queue.length)
        {
            const name = queue.shift(); if (searched.has(name)) continue; searched.add(name);
            for (const h of carbon.headers.get(name) ?? [])
            {
                for (const m of h.methods) nativeMethods.add(m);
                for (const base of h.bases) queue.push(base);
            }
        }
        const nativeProperties = native.flatMap(n => carbon.properties.get(n) ?? []);

        /** A __Field property row: Carbon's accessors for the exposed name must just read and write one member. */
        const checkField = (at, key, exposed, owners) =>
        {
            if (!accessorBodies) return;
            const row = nativeProperties.find(r => r.name === exposed && r.getter);
            if (!row) return;
            const readOnly = key.includes("mapPropertyReadOnly");
            let check = null;
            for (const owner of owners)
            {
                check = checkAccessorBodies(owner, row.getter, readOnly ? null : row.setter);
                if (!check.reasons.some(x => /has no definition beside the class/.test(x))) break;
            }
            if (check && !check.ok) add("property-field-body", c, at, "Carbon's accessors do more than read and write one member, so the property cannot sit on a plain field.", check.reasons);
        };

        // A be.map* above a class names a member the class inherits; its getter may be declared on a base (decorator-upgrade.md § 00).
        for (const d of (c.decorators ?? []).filter(d => PROPERTY_FIELD.test(d.name)))
            for (const name of [ d.args[0] ].flat()) checkField({ name: String(name), line: d.line }, d.name, name, [ ...searched ]);

        for (const m of c.members)
        {
            const ds = m.decorators ?? [];
            for (const d of ds.filter(d => PROPERTY_FIELD.test(d.name))) checkField(m, d.name, d.args[0] ?? m.name, [ ...searched ]);
            if (!native.length || m.kind !== "method" || ds.some(d => d.name === "meta.cjs")) continue;
            const name = m.name.replace(/^[_#]/, "").split("__")[0];
            const candidates = [ m.name, name, ...ds.filter(d => d.name === "meta.renamed").map(d => d.args[0]) ];
            if (m.static) candidates.push(name[0]?.toUpperCase() + name.slice(1));
            if (name === "Destruct") for (const n of native) candidates.push("~" + n.split("::").at(-1));
            // A constructor overload is create__Discriminator and an assignment operator is Assign__Discriminator (decorator-upgrade.md § 00);
            // the scan records a constructor under the class name and an operator with its symbol.
            if (name === "create") for (const n of native) candidates.push(n.split("::").at(-1));
            if (name === "Assign") candidates.push("operator=");
            if (!candidates.some(n => nativeMethods.has(n))) add("carbon-origin-name", c, m,
                "No header method match; review free functions, extracted helpers and explicit own origin.", { identities: native, searched: [ ...searched ] });
        }
    }
    for (const diagnostic of inventory.diagnostics) add("inventory-unresolved", { source: diagnostic.source, name: diagnostic.class ?? "<inventory>" }, null, diagnostic.kind, diagnostic);
    return findings;
}

/** Stable finding identity ignores source line shifts and platform line endings. */
export function findingFingerprint(f)
{
    return crypto.createHash("sha256").update(JSON.stringify([f.rule,f.source,f.class,f.member,f.detail,f.evidence],
        (key,value)=>key === "line" ? undefined : typeof value === "string" ? value.replaceAll("\r\n","\n") : value)).digest("hex");
}

/**
 * An update only retires resolved findings; new findings can never enter the baseline.
 * A declared rename ({class,from,to}) carries a baselined finding to its new member name: the finding must exist under `to` now and its
 * fingerprint with `from` substituted must already be in the baseline, so a genuinely new finding is never absorbed.
 */
export function shrinkBaseline(findings, baseline, renames=[])
{
    const known = new Set(baseline.fingerprints);
    for(const rename of renames)
        for(const f of findings)
            if(f.class===rename.class&&f.member===rename.to&&known.has(findingFingerprint({...f,member:rename.from})))
                known.add(findingFingerprint(f));
    const current = new Set(findings.map(findingFingerprint));
    return {version:1,fingerprints:[...known].filter(value=>current.has(value)).sort()};
}

/** Runtime-only report. Baseline updates shrink. */
export function run(argv)
{
    const args=new Map();for(let i=0;i<argv.length;i++)if(argv[i].startsWith("--"))args.set(argv[i],argv[i+1]?.startsWith("--")?true:argv[++i]??true);
    const root=path.resolve(args.get("--root")??fileURLToPath(new URL("..",import.meta.url)));
    const packageFile=path.join(root,"package.json");
    const packageName=fs.existsSync(packageFile)?JSON.parse(fs.readFileSync(packageFile,"utf8")).name:null;
    if(packageName!=="@carbonenginejs/runtime")
    {
        const report={mode:"report-only",scope:"excluded",packageName,counts:{},total:0,newFindings:0,findings:[],
            reason:"The audit applies only to runtime; application packages are excluded."};
        if(args.has("--output"))fs.writeFileSync(args.get("--output"),JSON.stringify(report,null,2)+"\n");
        console.log(JSON.stringify(report));return report;
    }
    const reportRoot=path.resolve(args.get("--reports")??process.env.CARBON_BLUE_REPORTS??defaultReports);
    const reports=REPORT_FILES.map(file=>path.join(reportRoot,file)).filter(file=>fs.existsSync(file));
    if(!reports.length)
    {
        const report={mode:"report-only",scope:"skipped",counts:{},total:0,newFindings:0,findings:[],
            reason:`No carbon-blue report in ${reportRoot}: run \`npm run scan\` and \`npm run scan:trinity\` in tools-core, or set CARBON_BLUE_REPORTS.`};
        console.log(JSON.stringify(report));return report;
    }
    const carbon=readCarbonReports(reports.map(file=>JSON.parse(fs.readFileSync(file,"utf8"))));
    const accessorBodies=fs.existsSync(process.env.CARBON_ROOT??"E:/carbonengine");
    const findings=auditDecorators(inventoryRuntime(root,{markers:args.get("--markers")??"both"}),carbon,{accessorBodies});
    const baselinePath=path.join(root,"scripts/baselines/decorator-target.json");
    let previous=fs.existsSync(baselinePath)?JSON.parse(fs.readFileSync(baselinePath,"utf8")):null;
    if(args.has("--write-baseline"))
    {
        if(!previous)throw new Error("Shrink-only baseline update requires an existing baseline.");
        const renames=[args.get("--rename")].flat().filter(v=>typeof v==="string").flatMap(v=>v.split(",")).map(v=>{const [cls,pair]=v.split(":");const [from,to]=pair.split("=");return {class:cls,from,to};});
        previous=shrinkBaseline(findings,previous,renames);
        fs.writeFileSync(baselinePath,JSON.stringify(previous,null,2)+"\n");
    }
    const baseline=new Set(previous?.fingerprints??[]);
    const counts={};for(const f of findings){counts[f.rule]=(counts[f.rule]??0)+1;f.baselined=baseline.has(findingFingerprint(f));}
    const report={mode:"report-only",scope:"runtime",baselinePolicy:"shrink-only",counts,total:findings.length,newFindings:findings.filter(f=>!f.baselined).length,findings};
    if(args.has("--output"))fs.writeFileSync(args.get("--output"),JSON.stringify(report,null,2)+"\n");
    console.log(JSON.stringify({mode:report.mode,scope:report.scope,counts,total:report.total,newFindings:report.newFindings}));
    return report;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)run(process.argv.slice(2));
