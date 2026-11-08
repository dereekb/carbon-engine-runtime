import { blue } from "#blue";
import { CjsPaperDollDefinition } from "../CjsPaperDollDefinition.js";

/**
 * A makeup category's options (eyes, eyebrows, blush), listed from the indexed build and read through the one
 * character library: each `.type` in the category's folder is one option, with its part folder's channel maps (one
 * per stem, at the texture quality), its metadata, its default palette and the palettes it and the category offer.
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
     * @param {{ Ready: function(Promise<*>): Promise<*>, content: { root: string } }} build The build: its waits and its
     *   content root, which names the sex's resource family.
     * @param {{ paths?: object, characterLibrary?: object }} [services] The paths service listed and the library read;
     *   Blue's own by default.
     * @returns {Promise<{ options: object[], untypedDirectories: string[], build: string }>} The options, by `.type`.
     * @throws {Error} For a type with a variation, or a channel stem with more than one map at its tier.
     */
    static async read(category, build, { paths = blue.paths, characterLibrary = blue.characterLibrary } = {})
    {
        const root = build.content.root, folder = root + "makeup/" + category + "/";
        const files = CjsPaperDollDefinition.listFiles(folder, paths), options = [];
        const palette = path => ({ path, label: path.slice(path.lastIndexOf("/") + 1, -6) });
        for (const definition of files.filter(path => path.endsWith(".type")))
        {
            const [ part, variation, colour ] = (await build.Ready(characterLibrary.FetchType(definition))).value;
            if (variation) throw Error("Unqualified makeup variation: " + definition);
            const base = root + part + "/";
            const direct = files.filter(path => path.startsWith(base) && !path.slice(base.length).includes("/"));
            const channels = {};
            const stems = new Set(direct.filter(path => path.endsWith(".png")).map(path => CjsPaperDollDefinition.splitTier(path)[0].slice(base.length)));
            for (const stem of stems)
            {
                const candidates = CjsPaperDollDefinition.tierCandidates(direct, stem);
                if (candidates.length !== 1) throw Error("Ambiguous makeup channel: " + base + stem);
                channels[stem] = { path: candidates[0] };
            }
            const metadataPath = base + "metadata.yaml";
            const palettes = [ ...new Set([ ...direct.filter(path => path.endsWith(".color")), ...files.filter(path => path.startsWith(folder + "colors/") && path.endsWith(".color")) ]) ].map(palette);
            options.push({
                id: definition.slice(definition.lastIndexOf("/") + 1, -5), part, definition, channels,
                metadata: direct.includes(metadataPath) ? await build.Ready(characterLibrary.FetchAvatarPartMetaData(metadataPath)) : null,
                defaultPalette: colour ? base + colour + ".color" : direct.includes(base + "default.color") ? base + "default.color" : null,
                palettes, geometry: direct.filter(path => /\.(black|gr2)$/.test(path))
            });
        }
        return { options, untypedDirectories: [], build: "resource index" };
    }

}
