import assert from "node:assert/strict";
import { test } from "node:test";

import { CjsByteReader } from "../../../../src/resource/format/CjsByteReader.js";
import { CjsReader } from "../../../../src/resource/format/CjsReader.js";
import { CjsCarbonEffectReader } from "../../../../src/resource/format/carbonEffect/CjsCarbonEffectReader.js";
import { HlslReader } from "../../../../src/resource/formats/hlsl/core/HlslReader.js";
import { DxbcReader } from "../../../../src/resource/formats/dxbc/core/DxbcReader.js";
import { DxbcReadError } from "../../../../src/resource/formats/dxbc/core/DxbcReadError.js";
import { YamlReader } from "../../../../src/blue/formats/yaml/YamlReader.js";
import { IRootReaderBase } from "../../../../src/blue/formats/black/IRootReaderBase.js";
import { CjsYamlReader } from "../../../../src/resource/formats/yaml/core/CjsYamlReader.js";

test("YamlReader stands on Carbon's stream base", () =>
{
    assert.equal(YamlReader.prototype instanceof IRootReaderBase, true);
});

test("byte-cursor readers share one little-endian implementation", () =>
{
    // Both backend chunk readers are gone. WebgpuReader went with the WebGPU
    // chunk package and WebglReader with the WebGL one; both backends read
    // through CjsCarbonEffectReader now, which this list covers.
    for (const Reader of [ HlslReader, DxbcReader, CjsCarbonEffectReader ])
    {
        assert.equal(Reader.prototype instanceof CjsByteReader, true);
        assert.equal(Reader.prototype instanceof CjsReader, true);
        assert.notEqual(Reader.ReadError, undefined);
        assert.equal(typeof Reader.endOfDataMessage, "string");
    }
    assert.equal(CjsByteReader.prototype instanceof CjsReader, true);

    // Each format keeps its own error identity while sharing the cursor.
    const bytes = new Uint8Array(2);
    assert.throws(() => new HlslReader(bytes).ReadUint32(), /Unexpected end of effect data/);
    assert.throws(
        () => new CjsCarbonEffectReader(bytes).ReadUint32(),
        /Unexpected end of Carbon effect data/u
    );

    // DXBC reports its own error class and keeps the message it used before it
    // became a subclass; the base default would silently read "end of data".
    assert.throws(() => new DxbcReader(bytes).ReadUint32(), DxbcReadError);
    assert.throws(() => new DxbcReader(bytes).ReadUint32(), /Unexpected end of effect data/);

    // The source name reaches the detail bag through the shared _error path.
    assert.throws(
        () => new DxbcReader(bytes, { source: "shader.dxbc" }).ReadUint32(),
        (error) => error.details.source === "shader.dxbc" && error.details.requested === 4
    );
});

test("YAML shares only the generic construction-bound lifecycle", () =>
{
    assert.equal(CjsYamlReader.prototype instanceof CjsReader, true);
    assert.equal("dispose" in CjsReader.prototype, false);
    assert.equal("clear" in CjsReader.prototype, false);
});
