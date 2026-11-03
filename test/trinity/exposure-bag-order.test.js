import assert from "node:assert/strict";
import test from "node:test";
import "../../npm/dist/blue/blue/index.js";
import { CjsSchema } from "../../npm/dist/blue/schema/index.js";
import "../../npm/dist/trinity/index.js";
import { YamlWriter } from "../../npm/dist/blue/blue/YamlWriter.js";
import { YamlReader } from "../../npm/dist/blue/blue/YamlReader.js";
import { IRootReaderBase } from "../../npm/dist/blue/blue/format/IRootReaderBase.js";

// decorator-upgrade.md § 000a: a class declared with an exposure bag writes, copies and lists its members in Carbon's order.

/** The class's own transported members, in the order the writers visit them. */
function ownOrder(Class)
{
    return IRootReaderBase.getDictionaryDeclarations(Class).fields.filter(field => field.declaringClass === Class).map(field => field.name);
}

test("EveShip2 writes its members in EveShip2_Blue.cpp's order", () =>
{
    const EveShip2 = CjsSchema.getConstructor("EveShip2");
    // EveShip2_Blue.cpp:16-21: speed, maxSpeed, displayKillCounterValue, (audioSpeedParameter, not persisted), boosters.
    assert.deepEqual(ownOrder(EveShip2), [ "speed", "maxSpeed", "displayKillCounterValue", "boosters" ]);
    assert.deepEqual(CjsSchema.getSchema(EveShip2).exposureRows.map(row => row.name),
        [ "speed", "maxSpeed", "displayKillCounterValue", "audioSpeedParameter", "boosters", "boosters", "RebuildBoosterSet" ]);
});

test("EveEllipsoidVolume writes shape before innerShape, so a re-read keeps innerShape", () =>
{
    const Volume = CjsSchema.getConstructor("EveEllipsoidVolume");
    // EveEllipsoidVolume_Blue.cpp:15-21.
    assert.deepEqual(ownOrder(Volume), [ "name", "position", "shape", "innerShape", "rotation", "debugShowIntersection" ]);

    const volume = new Volume();
    volume.shape.set([ 10, 20, 30 ]);
    volume.innerShape.set([ 5, 6, 7 ]);
    volume.Initialize();
    const text = new YamlWriter().WriteObjectToString(volume);
    assert.ok(text.indexOf("shape:") < text.indexOf("innerShape:"), "shape is written first");
    const back = new YamlReader().CreateObjectFromString(text);
    assert.deepEqual(Array.from(back.innerShape), [ 5, 6, 7 ], "Setup no longer clamps innerShape against a zero shape on re-read");
    assert.deepEqual(Array.from(back.shape), [ 10, 20, 30 ]);
});
