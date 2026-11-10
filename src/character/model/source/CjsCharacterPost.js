import { meta, type } from "#schema";

// Discovery: src/character/discovery/posts.yaml
// Additional discovery: scenes_post.yaml
// Resource pattern: res:/graphics/character/global/paperdolllibrary/posts/*

/**
 * A post's LUT settings. Files write it in two layouts; the scalar one (`lut: ''`, `lut_influence: 0`) is always the
 * empty post, and the reader reads it into these fields (`CjsCharacterObjectBuilder`, `ReadScalarPost`). The layout
 * is the library's fact about the item, not a field.
 * Storage defaults initialize empty records; they are not inferred authored defaults.
 */
@meta.define("CjsCharacterPost")
export class CjsCharacterPost
{

    /** Authored boolean value. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.boolean
    lut = false;

    /** Authored 4-component numeric tuple. Plain number storage avoids float32 rounding; source length is 4. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.list("float64")
    lut_influence = [0, 0, 0, 0];

    /** Authored resource reference; resolution never replaces this string. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.path("TriTextureRes")
    lut_path = "";

    /** Optional authored boolean in scene posts. The reader/writer preserves its absence. */
    @meta.mapAttribute(meta.READWRITE | meta.PERSIST)
    @type.boolean
    transmission_noise = false;

}
