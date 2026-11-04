// Strict caller assertions shared by effect translators. Carbon's format reader
// owns permutation resolution; these existing WebGPU checks ensure a request
// never silently resolves to a different option in either browser backend.

/**
 * Normalize caller permutation assertions without coercing malformed values.
 *
 * @param {object[]|Map<string,string>|null|undefined} value Permutation assertions.
 * @returns {object[]} `{ name, value }` assertion records.
 */
export function normalizeEffectPermutation(value)
{
    if (value === undefined || value === null)
    {
        return [];
    }

    const entries = value instanceof Map
        ? Array.from(value, ([ name, option ]) => ({ name, value: option }))
        : value;

    if (!Array.isArray(entries))
    {
        throw new TypeError("Effect permutation policy must be an array or Map");
    }

    return entries.map((entry) =>
    {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)
            || typeof entry.name !== "string" || !entry.name
            || typeof entry.value !== "string" || !entry.value)
        {
            throw new TypeError("Requested effect permutation is malformed");
        }

        return {
            name: entry.name,
            value: entry.value
        };
    });
}

/**
 * Verify that every requested permutation resolved exactly.
 *
 * @param {object[]} requested Requested `{ name, value }` records.
 * @param {object[]} selectedOptions Resolved effect option records.
 * @returns {true} True when every request resolved exactly.
 */
export function validateResolvedPermutation(requested, selectedOptions)
{
    if (!Array.isArray(requested) || !Array.isArray(selectedOptions))
    {
        throw new TypeError("Effect permutation validation requires requested and selected option arrays");
    }

    const requestedNames = new Set();
    const selectedByName = new Map();

    for (const entry of selectedOptions)
    {
        if (typeof entry?.name !== "string" || !entry.name || selectedByName.has(entry.name))
        {
            throw new Error("Effect selectedOptions are malformed or duplicated");
        }

        selectedByName.set(entry.name, entry);
    }

    for (const entry of requested)
    {
        if (typeof entry?.name !== "string" || !entry.name
            || typeof entry.value !== "string" || !entry.value)
        {
            throw new Error("Requested effect permutation is malformed");
        }

        if (requestedNames.has(entry.name))
        {
            throw new Error(`Requested effect permutation duplicates axis ${entry.name}`);
        }

        requestedNames.add(entry.name);
        const resolved = selectedByName.get(entry.name);

        if (!resolved)
        {
            throw new Error(`Unknown effect permutation axis ${entry.name}`);
        }

        if (resolved.value !== entry.value)
        {
            throw new Error(
                `Effect permutation ${entry.name} requested ${entry.value} but resolved ${resolved.value}`
            );
        }
    }

    return true;
}
