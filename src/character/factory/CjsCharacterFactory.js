import { blue } from "#blue";
import { CjsSchema } from "#schema";
import { CjsPaperDollDefinition } from "../application/CjsPaperDollDefinition.js";
import { CjsCharacterLibraryManager } from "../library/CjsCharacterLibraryManager.js";
import { CjsCharacterObjectBuilder } from "../formats/CjsCharacterObjectBuilder.js";
import { normalizeResourcePath } from "#utils/path";
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
    recipePath: "string",
    recipeVariation: "string",
    weight: "number",
    overridable: "boolean"
};

/** The sexes a character has, and their default paper dolls. */
const DEFAULTS = { female, male };

/**
 * The character factory: everything that knows what a character is (character-structure-and-plugins.md, "One role
 * per manager"). DNA in and out as a plain JS object, so a character can be built any way; the sex defaults, which it
 * owns (`defaults/defaultFemalePaperDoll.json`, `defaults/defaultMalePaperDoll.json`); and their merge with a DNA.
 * It hydrates a paper doll definition from a DNA (`build`) and puts a part or the whole character back to its defaults
 * (`resetPart`, `reset`). It reads the game's `.prs` recipes, which are DNA, into a DNA (`readRecipe`): their format
 * is its own (`recipeConfiguration`, `registerObjectBuilders`). It holds no content facts: those are the parts
 * library's (`blue.characterLibrary`).
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
    static readJSON(input)
    {
        const value = typeof input === "string" ? JSON.parse(input) : input;
        if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("A character DNA is an object");
        for (const key of Object.keys(value)) if (![ "sex", "description", "parts" ].includes(key)) throw new Error("Unknown character DNA field " + key);
        if (!Object.hasOwn(DEFAULTS, value.sex)) throw new Error("Unknown character sex " + value.sex);
        const dna = { sex: value.sex, parts: {} };
        if (value.description !== undefined) dna.description = String(value.description);
        for (const [ name, part ] of Object.entries(value.parts ?? {})) dna.parts[name] = CjsCharacterFactory._readPart(name, part);
        return dna;
    }

    /**
     * Writes a DNA as JSON text.
     * @param {object} dna The DNA.
     * @returns {string} Its JSON, two-space indented.
     * @throws {Error} For a DNA `readJSON` refuses.
     */
    static writeJSON(dna)
    {
        return JSON.stringify(CjsCharacterFactory.readJSON(dna), null, 2);
    }

    /**
     * A sex's default paper doll, a copy the caller may change.
     * @param {string} sex The sex.
     * @returns {{ sex: string, description: string, parts: Object<string, object> }}
     * @throws {Error} For a sex the factory does not know.
     */
    static getDefaults(sex)
    {
        if (!Object.hasOwn(DEFAULTS, sex)) throw new Error("Unknown character sex " + sex);
        return CjsCharacterFactory.readJSON(DEFAULTS[sex]);
    }

    /**
     * Merges a DNA over its sex's defaults: every part the defaults name, then each DNA part over its default, and a
     * part neither names switched off. A default part with `overridable: false` keeps its default values; the paper
     * doll's bake rules (occludes) can still remove it. What the DNA set and the merge did not apply is reported.
     * @param {object} input The DNA.
     * @returns {{ sex: string, parts: Object<string, object>, problems: string[] }} A new DNA naming every part.
     * @throws {Error} For a DNA `readJSON` refuses.
     */
    static merge(input)
    {
        const dna = CjsCharacterFactory.readJSON(input), defaults = CjsCharacterFactory.getDefaults(dna.sex);
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
     * The merged values of a DNA, per part, as a host writes them (`merge` without its problems): every part named.
     * @param {object} dna The DNA.
     * @returns {Object<string, object>} The values, by part.
     */
    static buildValues(dna)
    {
        return CjsCharacterFactory.merge(dna).parts;
    }

    /**
     * Hydrates a paper doll definition from a DNA, in place: each part to neutral, then the DNA merged over its sex's
     * defaults (`merge`). Each part takes its values; an option is resolved when the part is on (its files read through
     * the parts library) and set unresolved when it is off; a palette's colours are read (`_applyColors`). The
     * definition's dirty flags are left for the paper doll's update. What could not be applied (an option the part does
     * not list, a part that is not overridable) is reported, and the rest still applies.
     * @param {import("../application/CjsPaperDollDefinition.js").CjsPaperDollDefinition} definition The definition, its
     *   sources configured.
     * @param {object} dna The DNA; its sex is the definition's.
     * @returns {Promise<{ problems: string[] }>} What was not applied.
     */
    static async build(definition, dna)
    {
        const merged = CjsCharacterFactory.merge(dna), problems = [ ...merged.problems ];
        for (const name of CjsCharacterFactory.parts)
        {
            try { await CjsCharacterFactory._applyPart(definition[name], merged.parts[name], name === "archetype"); }
            catch (error) { problems.push(name + ": " + error.message); }
        }
        return { problems };
    }

    /**
     * Puts one part back to its sex's default: neutral, then the default's values (`build` for one part).
     * @param {import("../application/CjsPaperDollDefinition.js").CjsPaperDollDefinition} definition The definition.
     * @param {string} name The part.
     * @returns {Promise<void>}
     * @throws {Error} For a part the factory does not know, or a default that cannot apply.
     */
    static async resetPart(definition, name)
    {
        if (!CjsCharacterFactory.parts.includes(name)) throw new Error("Unknown character part " + name);
        await CjsCharacterFactory._applyPart(definition[name], CjsCharacterFactory.buildValues({ sex: definition.sex, parts: {} })[name], name === "archetype");
    }

    /**
     * Puts the whole character back to its sex's default: one walk over the definition's parts to neutral (off, no
     * custom colours, the archetype's sculpts and strength, the layer order), then the defaults (`build` of an empty
     * DNA, or the DNA given). The result is the freshly built character: the default, or the DNA's (a loaded recipe's).
     * @param {import("../application/CjsPaperDollDefinition.js").CjsPaperDollDefinition} definition The definition.
     * @param {object} [dna] The DNA to build over the defaults; none by default.
     * @returns {Promise<{ problems: string[] }>} What could not apply.
     */
    static async reset(definition, dna = { sex: definition.sex, parts: {} })
    {
        definition.archetype.ClearSculpts();
        definition.ResetLayers();
        return CjsCharacterFactory.build(definition, dna);
    }

    /**
     * Writes one merged part onto its component. The component first goes to neutral (its `Reset`; then off, no option,
     * overridable, and a weighted part at weight 0, or 1 when the part is on); then the part's values; then its option,
     * resolved when the part is on; then its colours. The archetype has no switch or colours: its option is prepared
     * before it is set.
     * @param {object} component The definition's component.
     * @param {object} part The merged part's values.
     * @param {boolean} archetype Whether the part is the archetype.
     * @returns {Promise<void>}
     * @throws {Error} For an option the part does not list.
     */
    static async _applyPart(component, part, archetype)
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
        // A recipe option names its part folder in the part's own fields: read again for each one applied.
        if (option === "recipe") component.ForgetResolution(option);
        if (option && component.enabled) await component.ResolveOption(option);
        await CjsCharacterFactory._applyColors(component, { palette, secondaryPalette: component.constructor.secondaryPalettes ? secondaryPalette : "", colors, specularColors });
    }

    /**
     * A part's colours. PROVISIONAL (the operator's colour ruling is open): the DNA's own colours win (and its own
     * specular colours, where the part's surface reads them); else its palette's colours (and specular colours where the part's surface reads them), with a secondary palette's areas 2
     * and 3; else the resolved option's default palette where the option paints colour areas; else neutral grey.
     * @param {object} component The definition's component.
     * @param {{ palette: string, secondaryPalette: string, colors: ?number[][], specularColors: ?number[][] }} values The part's colour values.
     * @returns {Promise<void>}
     */
    static async _applyColors(component, { palette, secondaryPalette, colors, specularColors })
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
        const specular = component.constructor.paletteSpecular === true, library = blue.characterLibrary;
        const [ first, second ] = await Promise.all([ library.FetchPalette(primary, { specular }), secondaryPalette ? library.FetchPalette(secondaryPalette) : null ]);
        const values = { palette: primary, customColors: false, color1: Float32Array.from(first.colors[0]), color2: Float32Array.from(first.colors[1]), color3: Float32Array.from(first.colors[2]) };
        if (second)
        {
            values.secondaryPalette = secondaryPalette;
            values.color2 = Float32Array.from(second.colors[1]);
            values.color3 = Float32Array.from(second.colors[2]);
        }
        CjsSchema.setValues(component, values);
        if (specular) component.SetSpecularColors(first.specularColors);
    }

    /**
     * The parts whose recipe entries are reported and not applied until the instance owns meshes (R6): hair, beard and
     * the accessories. Derived: a build stage, not a content fact.
     * @type {string[]}
     */
    static notAppliedYet = [ "hair", "beard", "brow", "chin", "ears", "earsHigh", "earsLow", "glasses", "lips", "mask", "nose" ];

    /**
     * Reads a `.prs` recipe into a DNA: each entry's category and option from the parts library
     * (`ResolveRecipeEntry`), set on, at its weight, with its own colours (and their specular colours) or the palette
     * its colour variation names. An archetype entry sets the archetype (the library's option path). An entry the library
     * marks nude (`feet_nude`) turns its part off. What
     * cannot apply is reported: an entry in no category or one with no paper doll part, an entry no option presets that
     * is not a garment (a garment takes the part's `recipe` option, `FetchRecipeOption`, where the build ships its
     * folder), and the entries of parts not applied yet (`notAppliedYet`).
     * PROVISIONAL: the colour fields, as `_applyColors`.
     *
     * Ours (no Carbon counterpart): the client's paper doll is Python. Moved from the sources' own recipe handling.
     * @param {string} path The recipe's `res:` path.
     * @param {string} [sex=""] The sex, for a recipe that names none (5 of 63 shipped).
     * @returns {Promise<{ dna: { sex: string, parts: Object<string, object> }, problems: string[] }>}
     * @throws {Error} For a recipe and a call that name no sex.
     */
    static async readRecipe(path, sex = "")
    {
        const library = blue.characterLibrary, recipe = await CjsCharacterFactory.fetchRecipe(path);
        const recipeSex = recipe.GetSex() || sex;
        if (recipeSex !== "female" && recipeSex !== "male") throw new Error("The recipe " + path + " names no sex, and none was given");
        const dna = { sex: recipeSex, parts: {} }, problems = [], parts = CjsCharacterFactory._partsByCategory();
        for (const entry of recipe.GetModifiers())
        {
            const found = await library.ResolveRecipeEntry(recipeSex, entry);
            if (found === null) { problems.push(entry.path + ": no part (no paper doll category)"); continue; }
            if (found.category === "archetypes")
            {
                // The archetype's option is its folder below the root, as the paper doll's archetype names it.
                if (found.option !== null) dna.parts.archetype = { option: found.path };
                else problems.push(entry.path + ": no archetype");
                continue;
            }
            const name = parts.get(found.category) ?? null;
            if (name === null) { problems.push(entry.path + ": no part (" + found.category + ")"); continue; }
            if (CjsCharacterFactory.notAppliedYet.includes(name)) { problems.push(entry.path + ": " + name + " is not applied until the instance owns meshes (R6)"); continue; }
            if (found.option === null)
            {
                // The operator's ruling (feet_nude): an entry naming a part's bare state turns the part off.
                if (found.nude === true) { dna.parts[name] = { enabled: false }; continue; }
                // The operator's ruling: a garment no `.type` presets takes the part's `recipe` option.
                const recipeOption = CjsCharacterLibraryManager.categories[found.category].maps === "garment"
                    ? await library.FetchRecipeOption(recipeSex, found.category, entry) : null;
                if (recipeOption === null)
                {
                    problems.push(entry.path + ": no " + name + " option presets it (variation '" + entry.variation + "', colour variation '" + entry.colorvariation + "')" + (CjsCharacterLibraryManager.categories[found.category].maps === "garment" ? ", and the build ships no such folder" : ""));
                    continue;
                }
                if (Object.hasOwn(dna.parts, name)) problems.push(entry.path + ": a second entry for " + name + "; the last applies");
                const value = { enabled: true, option: "recipe", recipePath: recipeOption.path, recipeVariation: recipeOption.variation };
                if (entry.weight > 0) value.weight = entry.weight;
                const palette = entry.colorvariation ? (await library.FetchPalettes(recipeOption)).find(record => record.name === entry.colorvariation) ?? null : null;
                if (palette !== null) value.palette = palette.path;
                else if (entry.colorvariation) problems.push(entry.path + ": no palette " + entry.colorvariation + " in its recipe option");
                dna.parts[name] = value;
                continue;
            }
            if (Object.hasOwn(dna.parts, name)) problems.push(entry.path + ": a second entry for " + name + "; the last applies");
            const value = { enabled: true, option: found.option };
            if (entry.weight > 0) value.weight = entry.weight;
            const read = CjsCharacterFactory._readRecipeColors(entry);
            if (read.problem) problems.push(entry.path + ": " + read.problem);
            if (read.colors)
            {
                value.colors = read.colors;
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
        return { dna: CjsCharacterFactory.readJSON(dna), problems };
    }

    /**
     * The shapes a recipe entry's `colors` takes (found: every `.prs` under `res:/graphics/character/` and
     * `res:/animation_gstate/`, build 3670638, 380 recipes): a list of RGBA tuples, written `[(..), (..), (..)]` or as
     * a tuple of tuples, then any scalars. `colors`: three tuples, one colour per area (3990 entries). `pattern`: an
     * entry that names a `pattern` holds that pattern's colours as a patterned palette's `patternColors` does
     * (`CjsCharacterColorVariation.patternOf`): the three pattern colours, the colours of areas 2 and 3, the placement
     * (offset x, y; repeat x, y) and the rotation (20 entries, all garments and arms).
     * @type {Object<string, { tuples: number, scalars: number }>}
     */
    static recipeColorShapes = { colors: { tuples: 3, scalars: 0 }, pattern: { tuples: 6, scalars: 1 } };

    /**
     * An entry's own colours, read by its shape (`recipeColorShapes`). A pattern entry's colours are read and not
     * applied: the part draws its colour variation's palette, whose pattern is its own. PROVISIONAL, with the colour
     * ruling. A shape that is neither is reported and its colours skipped, never thrown for the whole recipe.
     * @param {{ colors: string, pattern: string }} entry The recipe entry.
     * @returns {{ colors?: number[][], problem?: string }} The colours to apply, and what was not applied.
     */
    static _readRecipeColors(entry)
    {
        if (entry.colors === "") return {};
        const tuples = [ ...entry.colors.matchAll(/\(([^()]*)\)/gu) ].map(match => match[1].split(",").map(Number));
        const scalars = entry.colors.replace(/\(([^()]*)\)/gu, "").split(/[\[\],\s()]+/u).filter(token => token !== "").map(Number);
        const shape = entry.pattern ? CjsCharacterFactory.recipeColorShapes.pattern : CjsCharacterFactory.recipeColorShapes.colors;
        if (tuples.length !== shape.tuples || scalars.length !== shape.scalars || tuples.some(tuple => tuple.length !== 4 || !tuple.every(Number.isFinite)) || !scalars.every(Number.isFinite))
            return { problem: "colours in an unread shape (" + tuples.length + " tuples, " + scalars.length + " scalars); skipped" };
        if (entry.pattern) return { problem: "pattern " + entry.pattern + ": its own pattern colours are not applied; its colour variation's palette is (PROVISIONAL)" };
        return { colors: tuples };
    }

    /**
     * The shipped character recipes for a sex: the `.prs` files under the character root (`recipeConfiguration.match`;
     * the scenes' recipes are not characters) that name that sex (`GetSex`; a recipe that names none is left out),
     * sorted. Each recipe is read once (`fetchRecipe`); one that cannot be read is left out.
     * @param {"female"|"male"} sex The sex.
     * @returns {Promise<string[]>} The recipes' `res:` paths.
     */
    static async listRecipes(sex)
    {
        const found = [];
        for (const path of Array.from(blue.paths.Filter(CjsCharacterFactory.recipeConfiguration.match)).sort())
        {
            let recipe;
            try { recipe = await CjsCharacterFactory.fetchRecipe(path); }
            catch { continue; }
            if (recipe.GetSex() === sex) found.push(path);
        }
        return found;
    }

    /**
     * The factory's recipe format, as the parts library's configuration declares the files it reads
     * (`CjsCharacterLibraryConfiguration`): a recipe entry, with its colours and shape weights, is DNA, not part data
     * (Ruru, 2026-11-09). `kinds`: the `.prs` record, an envelope whose list's mappings are
     * `CjsCharacterRecipeModifier` records (`items`; the leading sex stays as written). `sourceLists`: the modifier's
     * list forms (`normalizeCharacterYamlValues`). `match`: the character recipes `listRecipes` lists.
     * @type {{ kinds: Object<string, object>, sourceLists: Object<string, Object<string, string[]>>, match: string }}
     */
    static recipeConfiguration = {
        kinds: { recipes: { className: "CjsCharacterRecipe", envelope: true, items: "CjsCharacterRecipeModifier" } },
        sourceLists: { CjsCharacterRecipeModifier: { specularcolors: [ "specularColor1", "specularColor2", "specularColor3" ] } },
        match: "res:/graphics/character/**/*.prs"
    };

    /**
     * Registers the recipe reader on a resMan: a `.prs` file builds through `CjsCharacterObjectBuilder` with the
     * factory's `recipeConfiguration`. `CjsLibrary` calls it beside the parts library's `Initialize`.
     *
     * Ours (non-carbon-extensions.md § *The shared character library*): as the character formats register
     * themselves (`CjsCharacterObjectBuilder.registerObjectBuilders`), after Carbon's modules
     * (`BLUE_REGISTER_RESOURCE_EXTENSION`, `IBlueResMan.h:151`).
     * @param {object} resMan The resource manager.
     * @returns {void}
     */
    static registerObjectBuilders(resMan)
    {
        resMan.RegisterObjectBuilder("prs", (bytes, context) =>
            new CjsCharacterObjectBuilder(bytes, "recipes", normalizeResourcePath(context.path), CjsCharacterFactory.recipeConfiguration));
    }

    /**
     * A `.prs` recipe, as its typed record (`CjsCharacterRecipe`), read through Blue's resMan
     * (`registerObjectBuilders`).
     * @param {string} path The file's canonical `res:` path.
     * @returns {Promise<import("../model/source/CjsCharacterRecipe.js").CjsCharacterRecipe>} The record; a file that does
     *   not load rejects.
     */
    static async fetchRecipe(path)
    {
        const record = await blue.resMan.LoadObject(path);
        if (!record) throw new Error("Character recipe did not load: " + path);
        return record;
    }

    /**
     * Each paper doll part by the parts library category it reads: its own category, and the one library category below
     * it that the library reads in full (has a maps rule). Two part classes name their category one folder up:
     * `tattoo` reads `tattoo/head` (`tattoo/armleft` has no maps rule), and `skintone` reads `skintone/basic`.
     * @returns {Map<string, string>}
     */
    static _partsByCategory()
    {
        if (CjsCharacterFactory._partsByCategoryCache === null)
        {
            const definition = new CjsPaperDollDefinition(), parts = new Map();
            for (const name of CjsPaperDollDefinition.parts) if (definition[name].constructor.category) parts.set(definition[name].constructor.category, name);
            for (const [ category, rule ] of Object.entries(CjsCharacterLibraryManager.categories))
            {
                const parent = category.slice(0, category.lastIndexOf("/"));
                if (rule.maps !== null && !parts.has(category) && parts.has(parent)) parts.set(category, parts.get(parent));
            }
            CjsCharacterFactory._partsByCategoryCache = parts;
        }
        return CjsCharacterFactory._partsByCategoryCache;
    }

    /** The parts by category, made once (`_partsByCategory`). @type {?Map<string, string>} */
    static _partsByCategoryCache = null;

    /**
     * One DNA part, checked and copied.
     * @param {string} name The part.
     * @param {object} part Its values.
     * @returns {object} A new part.
     * @throws {Error} For a part no paper doll has, a field outside the DNA, or a value of the wrong type.
     */
    static _readPart(name, part)
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
