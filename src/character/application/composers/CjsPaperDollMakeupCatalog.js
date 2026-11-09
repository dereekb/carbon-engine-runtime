import { blue } from "#blue";

/**
 * A makeup category's options (eyes, eyebrows, blush), from the parts library (`blue.characterLibrary`): each option
 * (`FetchOptions`, one per `.type`) with its part folder's channel maps (`FetchOptionMaps` by the catalog rule: one
 * per stem, at the texture quality), its metadata and models (`FetchOptionPart`), its default palette
 * (`ResolveColors`) and the palettes it and the category offer (`FetchPalettes`).
 *
 * Ours (no Carbon counterpart): Carbon ships no paper doll; the client's is Python. Moved from Graphene's
 * `componentCatalog.js` (character-structure-and-plugins.md R5); the name is a working name.
 */
export class CjsPaperDollMakeupCatalog
{

    static className = "CjsPaperDollMakeupCatalog";

    /**
     * Reads a category's options.
     * @param {string} category The makeup folder (`eyes`, `eyebrows`, `blush`).
     * @param {{ Ready: function(Promise<*>): Promise<*>, content: { sex: string } }} build The build: its waits and its sex.
     * @param {{ characterLibrary?: object }} [services] The parts library read; Blue's own by default. A `paths` service
     *   is accepted and not used: the library lists.
     * @returns {Promise<{ options: object[], untypedDirectories: string[], build: string }>} The options, by `.type`.
     * @throws {Error} For a type with a variation, or a channel stem with more than one map at its tier (`FetchOptionMaps`).
     */
    static async read(category, build, { characterLibrary = blue.characterLibrary } = {})
    {
        const options = [];
        for (const option of await build.Ready(characterLibrary.FetchOptions(build.content.sex, "makeup/" + category)))
        {
            const [ part, maps, palettes, colors ] = await Promise.all([ characterLibrary.FetchOptionPart(option), characterLibrary.FetchOptionMaps(option),
                characterLibrary.FetchPalettes(option), characterLibrary.ResolveColors(option) ].map(value => build.Ready(value)));
            options.push({
                id: option.id, part: part.part, definition: option.typePath,
                channels: Object.fromEntries(Object.entries(maps.channels).map(([ stem, path ]) => [ stem, { path } ])),
                metadata: part.metadata, defaultPalette: colors.palette,
                palettes: palettes.map(record => ({ path: record.path, label: record.name })), geometry: part.models
            });
        }
        return { options, untypedDirectories: [], build: "resource index" };
    }

}
