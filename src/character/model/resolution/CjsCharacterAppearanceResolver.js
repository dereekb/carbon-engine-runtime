/**
 * The paper doll's suppression walk and utility-shape rules: which worn parts another removes ("occludes"), and how
 * metadata's utility shapes and occlusions combine (`resolveSuppressions`, `decodeUtilityShape`,
 * `decodeUtilityOcclusion`, `resolveUtilityShapes`). The schema-12 catalog resolution that shared this class went with
 * the prepared documents (2026-11-11).
 */
export class CjsCharacterAppearanceResolver
{

    /**
     * Walks the selections' suppression graph: an edge says `owner` suppresses
     * `target`. A selection on a cycle stays active. Otherwise suppression runs
     * from the roots (active selections no active selection suppresses, outside
     * a shared cycle), so a suppressed selection's own edges stop applying: if A
     * suppresses B and B suppresses C, C stays active.
     * @param {any[]} nodes The selections, in order.
     * @param {Map<any, {owner: any, rules: Set<string>}[]>} suppressions Edges by target: who suppresses it, and through which rules.
     * @returns {{cyclic: any[], applied: Map<any, {owner: any, rules: Set<string>}[]>}}
     *   The selections left active by a cycle, in node order, and each suppressed selection with the edges that applied, in application order.
     */
    static resolveSuppressions(nodes, suppressions)
    {
        const cyclic = nodes.filter(value =>
            HasSuppressionPath(suppressions, value, value));

        const active = new Set(nodes);
        const applied = new Map();
        while (true)
        {
            const roots = [ ...active ].filter(target =>
                !(suppressions.get(target) ?? []).some(value =>
                    active.has(value.owner)
                    && !ShareSuppressionCycle(suppressions, value.owner, target)));
            const next = new Map();
            for (const owner of roots)
            {
                for (const [ target, owners ] of suppressions)
                {
                    if (!active.has(target)
                        || ShareSuppressionCycle(suppressions, owner, target)) continue;
                    const value = owners.find(candidate => candidate.owner === owner);
                    if (!value) continue;
                    if (!next.has(target)) next.set(target, []);
                    next.get(target).push(value);
                }
            }
            if (!next.size) break;
            for (const [ target, owners ] of next)
            {
                active.delete(target);
                applied.set(target, owners);
            }
        }
        return { cyclic, applied };
    }

    /**
     * Decodes one authored `dependantModifiers` entry as a utility-shape
     * request: `utilityshapes/<target>` at weight 1, or
     * `utilityshapes/<target>###<number>` at that weight (zero and >1
     * allowed, never clamped). Any other `#` form, a non-numeric suffix and a
     * path outside `utilityshapes/` are unresolved.
     * @param {string} authoredValue The entry as authored.
     * @param {number|null} [relationWeight=null] A typed relation's weight; it wins over the suffix.
     * @param {string} [relationPath=""] A typed relation's modifier path; when not empty it wins over the authored path.
     * @returns {{modifierPath: string, targetName: string, weight: number, explicitWeight: boolean}|null}
     *   The lower-case normalized path, the morph target (the path's last segment, as authored), and its weight; null when unresolved.
     */
    static decodeUtilityShape(authoredValue, relationWeight = null, relationPath = "")
    {
        const authored = String(authoredValue);
        const weighted = authored.match(/^(utilityshapes\/.+?)###([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)$/iu);
        let base = authored;
        let weight = relationWeight;
        let explicitWeight = false;

        if (weighted)
        {
            base = weighted[1];
            const parsed = Number(weighted[2]);
            if (!Number.isFinite(parsed)) return null;
            weight = weight === null || weight === undefined ? parsed : weight;
            explicitWeight = true;
        }
        else if (authored.includes("#"))
        {
            return null;
        }

        const modifierPath = NormalizeUtilityPath(relationPath || base);
        if (!modifierPath) return null;
        if (weight === null || weight === undefined) weight = 1;
        if (!Number.isFinite(weight)) return null;

        return {
            modifierPath,
            targetName: base.slice(base.lastIndexOf("/") + 1),
            weight,
            explicitWeight
        };
    }

    /**
     * Decodes one authored `occludesModifiers` entry as a utility-shape
     * occlusion. An entry carrying `#` is unresolved.
     * @param {string} authoredValue The entry as authored.
     * @param {string} [relationPath=""] A typed relation's modifier path; when not empty it wins over the authored path.
     * @returns {{modifierPath: string}|null} The lower-case normalized path; null when unresolved or not a utility shape.
     */
    static decodeUtilityOcclusion(authoredValue, relationPath = "")
    {
        if (String(authoredValue).includes("#")) return null;
        const modifierPath = NormalizeUtilityPath(relationPath || authoredValue);
        return modifierPath ? { modifierPath } : null;
    }

    /**
     * Applies the utility-shape rule to the active selections' requests and
     * occlusions, grouped by path in first-request order. A request is
     * suppressed by any occlusion of its path, unless that occlusion's
     * `protectedOwner` is the request's owner. Requests left with differing
     * weights are a conflict and request nothing; otherwise all are retained.
     * @param {{modifierPath: string, weight: number, owner: any}[]} requests Decoded requests (decodeUtilityShape), each with its owner.
     * @param {{modifierPath: string, protectedOwner: any}[]} occlusions Decoded occlusions; `protectedOwner` is null when none.
     * @returns {{modifierPath: string, suppressed: object[], retained: object[], conflict: boolean}[]} One record per requested path.
     */
    static resolveUtilityShapes(requests, occlusions)
    {
        const grouped = new Map();

        for (const request of requests)
        {
            if (!grouped.has(request.modifierPath)) grouped.set(request.modifierPath, []);
            grouped.get(request.modifierPath).push(request);
        }

        const result = [];
        for (const [ modifierPath, values ] of grouped)
        {
            const matchingOcclusions = occlusions.filter(value =>
                value.modifierPath === modifierPath);
            const suppressed = [];
            const retained = [];

            for (const value of values)
            {
                if (matchingOcclusions.some(occlusion =>
                    occlusion.protectedOwner === null
                    || occlusion.protectedOwner !== value.owner)) suppressed.push(value);
                else retained.push(value);
            }

            result.push({ modifierPath, suppressed, retained, conflict: new Set(retained.map(value => value.weight)).size > 1 });
        }
        return result;
    }

}

function HasSuppressionPath(suppressions, owner, target, visited = new Set())
{
    if (visited.has(owner)) return false;
    visited.add(owner);
    for (const [ candidate, owners ] of suppressions)
    {
        if (!owners.some(value => value.owner === owner)) continue;
        if (candidate === target
            || HasSuppressionPath(suppressions, candidate, target, visited))
        {
            return true;
        }
    }
    return false;
}

function ShareSuppressionCycle(suppressions, left, right)
{
    return HasSuppressionPath(suppressions, left, right)
        && HasSuppressionPath(suppressions, right, left);
}

function NormalizeUtilityPath(value)
{
    const result = String(value ?? "")
        .replaceAll("\\", "/")
        .replace(/^\/+|\/+$/gu, "")
        .toLowerCase();

    if (!result.startsWith("utilityshapes/")
        || result.split("/").some(segment => !segment || segment === "." || segment === ".."))
    {
        return null;
    }

    return result;
}
