import { CjsPaperDollDefinition } from "../application/CjsPaperDollDefinition.js";
import female from "./defaults/defaultFemalePaperDoll.json" with { type: "json" };
import male from "./defaults/defaultMalePaperDoll.json" with { type: "json" };

/** The DNA a part may carry, and the type each takes. */
const PART_FIELDS = {
    enabled: "boolean",
    option: "string",
    palette: "string",
    secondaryPalette: "string",
    colors: "colors",
    weight: "number",
    overridable: "boolean"
};

/** The sexes a character has, and their default paper dolls. */
const DEFAULTS = { female, male };

/**
 * The character factory: everything that knows what a character is (character-structure-and-plugins.md, "One role
 * per manager"). DNA in and out as a plain JS object, so a character can be built any way; the sex defaults, which it
 * owns (`defaults/defaultFemalePaperDoll.json`, `defaults/defaultMalePaperDoll.json`); and their merge with a DNA.
 * Hydrating a paper doll and reading a `.prs` recipe join it in later steps. It holds no content facts: those are
 * the parts library's (`blue.characterLibrary`).
 *
 * A DNA is `{ sex, description?, parts: { <part>: { enabled?, option?, palette?, secondaryPalette?, colors?, weight?,
 * overridable? } } }`. A part is `archetype` or a `CjsPaperDollDefinition.parts` member; a palette is a `res:` path;
 * `colors` are three RGBA quadruples and win over `palette`. A part the DNA does not name is as its defaults have it.
 * PROVISIONAL: the colour fields (`palette`, `secondaryPalette`, `colors`) and their precedence wait on the operator's
 * colour ruling (the parts library's `ResolveColors` is provisional too).
 *
 * Ours (no Carbon counterpart): Carbon ships no paper doll; the client's is Python. Named after the factory role
 * (operator, 2026-11-09), as the space object factory is for ships.
 */
export class CjsCharacterFactory
{

    static className = "CjsCharacterFactory";

    /** The parts a DNA may name: the archetype, then every definition part. */
    static parts = [ "archetype", ...CjsPaperDollDefinition.parts ];

    /**
     * Reads a DNA: a JSON text or an already parsed value, checked and copied.
     * @param {string|object} input The DNA.
     * @returns {{ sex: string, description?: string, parts: Object<string, object> }} A new DNA.
     * @throws {Error} For a sex the factory does not know, a part no paper doll has, or a field outside the DNA.
     */
    static ReadJSON(input)
    {
        const value = typeof input === "string" ? JSON.parse(input) : input;
        if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("A character DNA is an object");
        for (const key of Object.keys(value)) if (![ "sex", "description", "parts" ].includes(key)) throw new Error("Unknown character DNA field " + key);
        if (!Object.hasOwn(DEFAULTS, value.sex)) throw new Error("Unknown character sex " + value.sex);
        const dna = { sex: value.sex, parts: {} };
        if (value.description !== undefined) dna.description = String(value.description);
        for (const [ name, part ] of Object.entries(value.parts ?? {})) dna.parts[name] = CjsCharacterFactory._ReadPart(name, part);
        return dna;
    }

    /**
     * Writes a DNA as JSON text.
     * @param {object} dna The DNA.
     * @returns {string} Its JSON, two-space indented.
     * @throws {Error} For a DNA `ReadJSON` refuses.
     */
    static WriteJSON(dna)
    {
        return JSON.stringify(CjsCharacterFactory.ReadJSON(dna), null, 2);
    }

    /**
     * A sex's default paper doll, a copy the caller may change.
     * @param {string} sex The sex.
     * @returns {{ sex: string, description: string, parts: Object<string, object> }}
     * @throws {Error} For a sex the factory does not know.
     */
    static GetDefaults(sex)
    {
        if (!Object.hasOwn(DEFAULTS, sex)) throw new Error("Unknown character sex " + sex);
        return CjsCharacterFactory.ReadJSON(DEFAULTS[sex]);
    }

    /**
     * Merges a DNA over its sex's defaults: every part the defaults name, then each DNA part over its default, and a
     * part neither names switched off. A default part with `overridable: false` keeps its default values; the paper
     * doll's bake rules (occludes) can still remove it. What the DNA set and the merge did not apply is reported.
     * @param {object} input The DNA.
     * @returns {{ sex: string, parts: Object<string, object>, problems: string[] }} A new DNA naming every part.
     * @throws {Error} For a DNA `ReadJSON` refuses.
     */
    static Merge(input)
    {
        const dna = CjsCharacterFactory.ReadJSON(input), defaults = CjsCharacterFactory.GetDefaults(dna.sex);
        const merged = { sex: dna.sex, parts: {}, problems: [] };
        for (const name of CjsCharacterFactory.parts)
        {
            const base = defaults.parts[name] ?? { enabled: false }, edit = dna.parts[name];
            if (edit === undefined) merged.parts[name] = { ...base };
            else if (base.overridable === false)
            {
                merged.parts[name] = { ...base };
                merged.problems.push(name + " is not overridable; the DNA's values are not applied");
            }
            else merged.parts[name] = { ...base, ...edit };
        }
        return merged;
    }

    /**
     * One DNA part, checked and copied.
     * @param {string} name The part.
     * @param {object} part Its values.
     * @returns {object} A new part.
     * @throws {Error} For a part no paper doll has, a field outside the DNA, or a value of the wrong type.
     */
    static _ReadPart(name, part)
    {
        if (!CjsCharacterFactory.parts.includes(name)) throw new Error("Unknown character part " + name);
        if (part === null || typeof part !== "object" || Array.isArray(part)) throw new Error("Character part " + name + " is not an object");
        const out = {};
        for (const [ key, value ] of Object.entries(part))
        {
            const kind = PART_FIELDS[key];
            if (kind === undefined) throw new Error("Unknown field " + key + " on character part " + name);
            if (kind === "colors")
            {
                if (!Array.isArray(value) || value.length !== 3 || value.some(color => !Array.isArray(color) || color.length !== 4 || !color.every(Number.isFinite)))
                    throw new Error("Character part " + name + " colors are not three RGBA quadruples");
                out.colors = value.map(color => [ ...color ]);
            }
            else if (typeof value !== kind || kind === "number" && !Number.isFinite(value)) throw new Error("Character part " + name + " " + key + " is not a " + kind);
            else out[key] = value;
        }
        return out;
    }

}
