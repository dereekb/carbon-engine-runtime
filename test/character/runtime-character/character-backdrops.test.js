import test from "node:test";
import assert from "node:assert/strict";
import { blue } from "../../../npm/dist/blue/index.js";
import { CjsCharacterBackdrops, Tr2InteriorScene } from "../../../npm/dist/character/index.js";

test("the backdrop list is the creator's backgrounds without their thumbnails, numbered first", t =>
{
    const directory = CjsCharacterBackdrops.directory;
    t.mock.method(blue.paths, "GetDirectoryContents", folder =>
    {
        assert.equal(folder, directory);
        return [ "background_10.dds", "background_10_thumb.dds", "background_2.dds", "background_triglavian.dds",
            "background_triglavian_thumb.dds", "background_1001.dds", "background_blood_raider.dds", "notes.txt" ];
    });
    const list = CjsCharacterBackdrops.list();
    assert.deepEqual(list.map(entry => entry.name), [ "2", "10", "1001", "blood_raider", "triglavian" ]);
    assert.equal(list[1].path, directory + "background_10.dds");
    assert.equal(list[1].thumbnail, directory + "background_10_thumb.dds");
    assert.equal(list[0].thumbnail, null, "a backdrop without a thumbnail lists none");
});

test("a backdrop sets the interior scene's background effect, and none clears it", () =>
{
    const scene = new Tr2InteriorScene();
    const path = CjsCharacterBackdrops.directory + "background_0.dds";
    const effect = CjsCharacterBackdrops.apply(scene, path);
    assert.equal(scene.backgroundEffect, effect);
    assert.equal(effect.effectFilePath, CjsCharacterBackdrops.effectPath);
    assert.equal(effect.GetResourceByName("BackgroundMap").resourcePath, path);
    const value = name => Array.from(effect.parameters.find(parameter => parameter.name === name).value);
    assert.deepEqual(value("BackgroundSettings"), [ CjsCharacterBackdrops.fits.cover, 0, 0, 0 ], "cover by default");
    assert.deepEqual(value("BackgroundPlacement"), [ 0, 0, 1, 1 ]);

    assert.equal(CjsCharacterBackdrops.apply(scene, ""), null);
    assert.equal(scene.backgroundEffect, null);
    assert.throws(() => CjsCharacterBackdrops.apply(scene, path, { fit: "tile" }), /cover, contain or stretch/);
});
