import { blue } from "#blue";
import { CjsSchema } from "#schema";
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
    specularColors: "colors",
    weight: "number",
    overridable: "boolean"
};

/** The sexes a character has, and their default paper dolls. */
const DEFAULTS = { female, male };

/**
 * The character factory: everything that knows what a character is (character-structure-and-plugins.md, "One role
 * per manager"). DNA in and out as a plain JS object, so a character can be built any way; the sex defaults, which it
 * owns (`defaults/defaultFemalePaperDoll.json`, `defaults/defaultMalePaperDoll.json`); and their merge with a DNA.
 * It hydrates a paper doll definition from a DNA (`Build`) and puts a part or the whole character back to its defaults
 * (`ResetPart`, `Reset`). Reading a `.prs` recipe joins it in a later step. It holds no content facts: those are
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
     * The merged values of a DNA, per part, as a host writes them (`Merge` without its problems): every part named.
     * @param {object} dna The DNA.
     * @returns {Object<string, object>} The values, by part.
     */
    static BuildValues(dna)
    {
        return CjsCharacterFactory.Merge(dna).parts;
    }

    /**
     * Hydrates a paper doll definition from a DNA, in place: each part to neutral, then the DNA merged over its sex's
     * defaults (`Merge`). Each part takes its values; an option is resolved when the part is on (its files read through
     * the parts library) and set unresolved when it is off; a palette's colours are read (`_ApplyColors`). The
     * definition's dirty flags are left for the paper doll's update. What could not be applied (an option the part does
     * not list, a part that is not overridable) is reported, and the rest still applies.
     * @param {import("../application/CjsPaperDollDefinition.js").CjsPaperDollDefinition} definition The definition, its
     *   sources configured.
     * @param {object} dna The DNA; its sex is the definition's.
     * @returns {Promise<{ problems: string[] }>} What was not applied.
     */
    static async Build(definition, dna)
    {
        const merged = CjsCharacterFactory.Merge(dna), problems = [ ...merged.problems ];
        for (const name of CjsCharacterFactory.parts)
        {
            try { await CjsCharacterFactory._ApplyPart(definition[name], merged.parts[name], name === "archetype"); }
            catch (error) { problems.push(name + ": " + error.message); }
        }
        return { problems };
    }

    /**
     * Puts one part back to its sex's default: neutral, then the default's values (`Build` for one part).
     * @param {import("../application/CjsPaperDollDefinition.js").CjsPaperDollDefinition} definition The definition.
     * @param {string} name The part.
     * @returns {Promise<void>}
     * @throws {Error} For a part the factory does not know, or a default that cannot apply.
     */
    static async ResetPart(definition, name)
    {
        if (!CjsCharacterFactory.parts.includes(name)) throw new Error("Unknown character part " + name);
        await CjsCharacterFactory._ApplyPart(definition[name], CjsCharacterFactory.BuildValues({ sex: definition.sex, parts: {} })[name], name === "archetype");
    }

    /**
     * Puts the whole character back to its sex's default: one walk over the definition's parts to neutral (off, no
     * custom colours, the archetype's sculpts and strength, the layer order), then the defaults (`Build` of an empty
     * DNA, or the DNA given). The result is the freshly built character: the default, or the DNA's (a loaded recipe's).
     * @param {import("../application/CjsPaperDollDefinition.js").CjsPaperDollDefinition} definition The definition.
     * @param {object} [dna] The DNA to build over the defaults; none by default.
     * @returns {Promise<{ problems: string[] }>} What could not apply.
     */
    static async Reset(definition, dna = { sex: definition.sex, parts: {} })
    {
        definition.archetype.ClearSculpts();
        definition.ResetLayers();
        return CjsCharacterFactory.Build(definition, dna);
    }

    /**
     * Writes one merged part onto its component. The component first goes to neutral (`Reset`; then off, no option,
     * overridable, and a weighted part at weight 0, or 1 when the part is on); then the part's values; then its option,
     * resolved when the part is on; then its colours. The archetype has no switch or colours: its option is prepared
     * before it is set.
     * @param {object} component The definition's component.
     * @param {object} part The merged part's values.
     * @param {boolean} archetype Whether the part is the archetype.
     * @returns {Promise<void>}
     * @throws {Error} For an option the part does not list.
     */
    static async _ApplyPart(component, part, archetype)
    {
        const { option = "", palette = "", secondaryPalette = "", colors = null, specularColors = null, ...rest } = part;
        if (option && !component.GetOptions().some(value => value.id === option)) throw new Error("option " + option + " is not listed");
        component.Reset();
        if (archetype)
        {
            if (option) await component.ResolveOption(option);
            CjsSchema.setValues(component, { ...(option ? { option } : {}), ...rest });
            return;
        }
        const values = { enabled: false, overridable: true, ...rest, option };
        // Derived: a weighted part the DNA turns on without a weight draws at full weight (the shipped recipes set 1.0).
        if (component.constructor.weighted === true) values.weight = rest.weight ?? (values.enabled ? 1 : 0);
        else delete values.weight;
        CjsSchema.setValues(component, values);
        if (option && component.enabled) await component.ResolveOption(option);
        await CjsCharacterFactory._ApplyColors(component, { palette, secondaryPalette: component.constructor.secondaryPalettes ? secondaryPalette : "", colors, specularColors });
    }

    /**
     * A part's colours. PROVISIONAL (the operator's colour ruling is open): the DNA's own colours win (and its own
     * specular colours, where the part's surface reads them); else its palette's colours (and specular colours where the part's surface reads them), with a secondary palette's areas 2
     * and 3; else the resolved option's default palette where the option paints colour areas; else neutral grey.
     * @param {object} component The definition's component.
     * @param {{ palette: string, secondaryPalette: string, colors: ?number[][], specularColors: ?number[][] }} values The part's colour values.
     * @returns {Promise<void>}
     */
    static async _ApplyColors(component, { palette, secondaryPalette, colors, specularColors })
    {
        if (colors !== null)
        {
            CjsSchema.setValues(component, { customColors: true, color1: Float32Array.from(colors[0]), color2: Float32Array.from(colors[1]), color3: Float32Array.from(colors[2]) });
            if (component.constructor.paletteSpecular && specularColors !== null) component.SetSpecularColors(specularColors.map(color => Float32Array.from(color)));
            return;
        }
        const selected = component.enabled && component.option ? component.GetOptions().find(value => value.id === component.option) : null;
        const primary = palette || (selected && selected.colorAreas.length && selected.defaultPalette ? selected.defaultPalette : "");
        if (!primary) return;
        const [ first, second ] = await Promise.all([ CjsCharacterFactory._ReadPalette(component, primary), secondaryPalette ? CjsCharacterFactory._ReadPalette(component, secondaryPalette) : null ]);
        const values = { palette: primary, customColors: false, color1: Float32Array.from(first.colors[0]), color2: Float32Array.from(first.colors[1]), color3: Float32Array.from(first.colors[2]) };
        if (second)
        {
            values.secondaryPalette = secondaryPalette;
            values.color2 = Float32Array.from(second.colors[1]);
            values.color3 = Float32Array.from(second.colors[2]);
        }
        CjsSchema.setValues(component, values);
        if (component.constructor.paletteSpecular) component.SetSpecularColors(first.specularColors ?? []);
    }

    /**
     * One palette's colours, and its specular colours where the part's surface reads them: a palette the part was
     * configured with (a recipe's `authored`) from the part, any other from the parts library (`FetchPalette`). Moved
     * from Graphene's `characterComponentEditing.js` (`ReadPalette`).
     * @param {object} component The definition's component.
     * @param {string} path The palette's `res:` path, or a configured palette's id.
     * @returns {Promise<{ colors: ArrayLike<number>[], specularColors: ?ArrayLike<number>[] }>}
     */
    static async _ReadPalette(component, path)
    {
        const specular = component.constructor.paletteSpecular === true, configured = component.GetPaletteColors(path);
        if (configured && !specular) return { colors: configured, specularColors: null };
        const configuredSpecular = configured && specular ? component.GetPaletteSpecularColors(path) : null;
        if (configuredSpecular) return { colors: configured, specularColors: configuredSpecular };
        const read = await blue.characterLibrary.FetchPalette(path, { specular });
        return { colors: configured ?? read.colors, specularColors: specular ? read.specularColors : null };
    }

    /**
     * The parts library categories whose paper doll part has another category (derived: the part classes name their
     * category one folder up).
     * @type {Object<string, string>}
     */
    static partOfCategory = { "tattoo/head": "tattoo", "skintone/basic": "skin" };

    /**
     * The parts whose recipe entries are reported and not applied until the instance owns meshes (R6): hair, beard and
     * the accessories. Derived: a build stage, not a content fact.
     * @type {string[]}
     */
    static notAppliedYet = [ "hair", "beard", "brow", "chin", "ears", "earsHigh", "earsLow", "glasses", "lips", "mask", "nose" ];

    /**
     * Reads a `.prs` recipe into a DNA: each entry's category and option from the parts library
     * (`ResolveRecipeEntry`), set on, at its weight, with its own colours (and their specular colours) or the palette
     * its colour variation names. An archetype entry sets the archetype. A `feet_nude` entry turns the feet off. What
     * cannot apply is reported: an entry in no category or one with no paper doll part, an entry no option presets (a
     * garment the part's `recipe` option will take, later), and the entries of parts not applied yet (`notAppliedYet`).
     * PROVISIONAL: the colour fields, as `_ApplyColors`.
     *
     * Ours (no Carbon counterpart): the client's paper doll is Python. Moved from the sources' own recipe handling.
     * @param {string} path The recipe's `res:` path.
     * @param {string} [sex=""] The sex, for a recipe that names none (5 of 63 shipped).
     * @returns {Promise<{ dna: { sex: string, parts: Object<string, object> }, problems: string[] }>}
     * @throws {Error} For a recipe and a call that name no sex.
     */
    static async ReadRecipe(path, sex = "")
    {
        const library = blue.characterLibrary, recipe = await library.FetchRecipe(path);
        const named = typeof recipe.value[0] === "string" ? recipe.value[0] : "", recipeSex = named || sex;
        if (recipeSex !== "female" && recipeSex !== "male") throw new Error("The recipe " + path + " names no sex, and none was given");
        const dna = { sex: recipeSex, parts: {} }, problems = [], parts = CjsCharacterFactory._PartsByCategory();
        for (const entry of recipe.GetModifiers())
        {
            const found = await library.ResolveRecipeEntry(recipeSex, entry);
            if (found === null) { problems.push(entry.path + ": no part (no paper doll category)"); continue; }
            if (found.category === "archetypes") { dna.parts.archetype = { option: entry.path.toLowerCase() }; continue; }
            const name = parts.get(found.category) ?? null;
            if (name === null) { problems.push(entry.path + ": no part (" + found.category + ")"); continue; }
            if (CjsCharacterFactory.notAppliedYet.includes(name)) { problems.push(entry.path + ": " + name + " is not applied until the instance owns meshes (R6)"); continue; }
            if (found.option === null)
            {
                // The operator's ruling: a nude feet entry turns the feet off.
                if (name === "feet" && /_nude$/u.test(entry.path)) { dna.parts.feet = { enabled: false }; continue; }
                problems.push(entry.path + ": no " + name + " option presets it (variation '" + entry.variation + "', colour variation '" + entry.colorvariation + "')");
                continue;
            }
            if (Object.hasOwn(dna.parts, name)) problems.push(entry.path + ": a second entry for " + name + "; the last applies");
            const value = { enabled: true, option: found.option };
            if (entry.weight > 0) value.weight = entry.weight;
            const colors = entry.GetColors();
            if (colors !== null)
            {
                value.colors = colors.map(color => Array.from(color));
                value.specularColors = [ entry.specularColor1, entry.specularColor2, entry.specularColor3 ].map(color => Array.from(color));
            }
            else if (entry.colorvariation)
            {
                const option = (await library.FetchOptions(recipeSex, found.category)).find(value => value.id === found.option);
                const palette = (await library.FetchPalettes(option)).find(record => record.name === entry.colorvariation) ?? null;
                if (palette !== null) value.palette = palette.path;
                else problems.push(entry.path + ": no palette " + entry.colorvariation + " for " + found.option);
            }
            dna.parts[name] = value;
        }
        return { dna: CjsCharacterFactory.ReadJSON(dna), problems };
    }

    /**
     * The shipped character recipes for a sex: every `.prs` under `res:/graphics/character/` whose first line names
     * that sex (a recipe that names none is left out), sorted. Each recipe is read once (`FetchRecipe`); one that
     * cannot be read is left out.
     * @param {"female"|"male"} sex The sex.
     * @returns {Promise<string[]>} The recipes' `res:` paths.
     */
    static async ListRecipes(sex)
    {
        const library = blue.characterLibrary, found = [];
        for (const path of await library.ListRecipeNames())
        {
            if (!path.startsWith("res:/graphics/character/")) continue;
            let recipe;
            try { recipe = await library.FetchRecipe(path); }
            catch { continue; }
            if (recipe.value[0] === sex) found.push(path);
        }
        return found.sort();
    }

    /**
     * Each paper doll part by the parts library category it reads (`partOfCategory` where they differ).
     * @returns {Map<string, string>}
     */
    static _PartsByCategory()
    {
        if (CjsCharacterFactory._partsByCategory === null)
        {
            const definition = new CjsPaperDollDefinition(), parts = new Map();
            for (const name of CjsPaperDollDefinition.parts) if (definition[name].constructor.category) parts.set(definition[name].constructor.category, name);
            for (const [ category, name ] of Object.entries(CjsCharacterFactory.partOfCategory)) parts.set(category, name);
            CjsCharacterFactory._partsByCategory = parts;
        }
        return CjsCharacterFactory._partsByCategory;
    }

    /** The parts by category, made once (`_PartsByCategory`). @type {?Map<string, string>} */
    static _partsByCategory = null;

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
                    throw new Error("Character part " + name + " " + key + " are not three RGBA quadruples");
                out[key] = value.map(color => [ ...color ]);
            }
            else if (typeof value !== kind || kind === "number" && !Number.isFinite(value)) throw new Error("Character part " + name + " " + key + " is not a " + kind);
            else out[key] = value;
        }
        return out;
    }

}
