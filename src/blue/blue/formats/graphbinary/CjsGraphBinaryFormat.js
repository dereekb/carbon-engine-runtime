import { CjsGraphFormat } from "../graph/CjsGraphFormat.js";
import { createHandlers, isRecord } from "../graph/core/dataTypes.js";

import { ARRAYS, arrayType } from "../graph/core/dataTypes.js";
import { bytes, readEnvelope, writeEnvelope } from "../graph/core/text.js";
const TYPES = new Map(Object.values(ARRAYS).map(([Ctor, type]) => [type, Ctor]));

TYPES.set("bytes", Uint8Array);

const MAGIC = [67, 74, 83, 66];

const ENDIAN_WORD = Uint16Array.of(1);

const LITTLE_ENDIAN = new Uint8Array(ENDIAN_WORD.buffer)[0] === 1;

/** Our graph grammar with owned binary typed payloads; independent of the text facade. */
export class CjsGraphBinaryFormat extends CjsFormat
{
    static className = "CjsGraphBinaryFormat";

    static id = "CjsGraphBinaryFormat";

    static wireFormat = "cjs.graph.binary";

    static version = 1;

    static extensions = [];

    static outputs = CjsFormat.defineOutputs({
        values: { default: true, decoded: true },
        runtime: { decoded: true }
    });

    static inputs = CjsFormat.defineInputs({ runtime: { default: true }, values: {} });

    /**
     * Hold a reusable detached profile; import/construction registers nothing.
     *
     * @param {object} [options={}] Profile options merged into every Read and Write.
     */
    constructor(options = {}) { super(options); }

    /**
     * Read with profile options.
     *
     * @param {ArrayBuffer|ArrayBufferView} input CJSB file bytes.
     * @param {object} [options={}] Read options, over the profile options.
     * @returns {import("../graph/core/dataTypes.js").GraphReadResult} The root and member reports.
     */
    Read(input, options = {}) { return CjsGraphBinaryFormat.read(input, { ...this.options, ...options }); }

    /**
     * Write with profile options.
     *
     * @param {object} root Runtime root instance or plain-value root.
     * @param {object} [options={}] Write options, over the profile options.
     * @returns {Uint8Array} The CJSB file bytes.
     */
    Write(root, options = {}) { return CjsGraphBinaryFormat.write(root, { ...this.options, ...options }); }

    /**
     * Decode framing and hand the same graph grammar a binary-specific storage handler.
     *
     * @param {ArrayBuffer|ArrayBufferView} input CJSB file bytes.
     * @param {object} [options={}] Read options.
     * @param {string} [options.emit="values"] "values" for plain values, "runtime" for registered instances.
     * @returns {import("../graph/core/dataTypes.js").GraphReadResult} The root and member reports.
     * @throws {TypeError} When options.emit is unknown.
     */
    static read(input, options = {})
    {
        const binary = CjsGraphBinaryFormat.openBinary(input, CjsGraphBinaryFormat.wireFormat);
        const emit = options.emit ?? "values";
        if (emit === "runtime") return CjsGraphFormat.readGraph(binary.root, createHandlers(CjsGraphBinaryFormat.binaryArray), { ...options, binary });
        if (emit !== "values") throw new TypeError(`Unknown graph output '${emit}'`);
        const reports = [];
        const root = CjsGraphFormat.plainGraph(binary.root, reports, value =>
        {
            if (isRecord(value) && Object.keys(value).length === 1 && Object.hasOwn(value, "_view")) return binary.read(value._view);
            if (isRecord(value) && Object.keys(value).length === 2 && Object.hasOwn(value, "_custom") && Object.hasOwn(value, "_view"))
            {
                return { _custom: value._custom, bytes: binary.read(value._view, "bytes") };
            }
            return value;
        });
        return { root, reports };
    }

    /**
     * Write all bulk data as byte spans without expanding typed-array elements.
     *
     * @param {object} root Runtime root instance or plain-value root.
     * @param {object} [options={}] Write options.
     * @param {string} [options.input="runtime"] "runtime" for registered instances, "values" for plain values.
     * @returns {Uint8Array} The CJSB file bytes.
     * @throws {TypeError} When options.input is unknown or a member fails.
     */
    static write(root, options = {})
    {
        const binary = CjsGraphBinaryFormat.createBinaryWriter();
        const input = options.input ?? "runtime";
        const reports = [];
        if (input === "runtime") root = CjsGraphFormat.writeGraph(root, createHandlers(CjsGraphBinaryFormat.binaryArray), { ...options, binary });
        else if (input === "values") root = CjsGraphFormat.plainGraph(root, reports, value => CjsGraphBinaryFormat.writePayload(value, binary));
        else throw new TypeError(`Unknown graph input '${input}'`);
        CjsGraphFormat.throwReports(reports);
        return binary.finish(root, CjsGraphBinaryFormat.wireFormat);
    }

    /**
     * Inspect framing and version without running registered class factories.
     *
     * @param {ArrayBuffer|ArrayBufferView} input CJSB file bytes.
     * @returns {import("../graph/core/dataTypes.js").GraphInspection} The format id, version and wire identity.
     */
    static inspect(input)
    {
        CjsGraphBinaryFormat.openBinary(input, CjsGraphBinaryFormat.wireFormat);
        return { format: { id: CjsGraphBinaryFormat.id, version: 1 }, wireFormat: CjsGraphBinaryFormat.wireFormat };
    }

    /**
     * Select by header; no filename extension participates.
     *
     * @param {string|null} _filename Resource path; unused.
     * @param {ArrayBuffer|ArrayBufferView} input Candidate file bytes.
     * @returns {boolean} True when the framing is valid CJSB for this format.
     */
    static is(_filename, input)
    {
        try { CjsGraphBinaryFormat.inspect(input); return true; }
        catch { return false; }
    }

    /**
     * V1 has no byte-swapping or host-endianness option.
     *
     * @throws {TypeError} When the host is big-endian.
     */
    static requireLittleEndian()
    {
                    if (!LITTLE_ENDIAN) throw new TypeError("Graph binary v1 requires a little-endian host");
    }

    /**
     * Arithmetic alignment avoids signed-32-bit truncation of large offsets.
     *
     * @param {number} value Byte offset.
     * @returns {number} The offset rounded up to a multiple of 8.
     */
    static _align8(value)
    { return Math.ceil(value / 8) * 8; }

    /**
     * A binary-section writer: `write` appends one typed payload and returns its bufferView index; `finish`
     * frames the JSON root and the payloads into one CJSB file.
     *
     * @typedef {object} GraphBinaryWriter
     * @property {Array<{byteOffset: number, byteLength: number, type: string, count: number}>} bufferViews View records written so far.
     * @property {function(ArrayBufferView, string): number} write Appends a payload of the named type.
     * @property {function(object, string): Uint8Array} finish Encodes the file around the wire root.
     */
    
    /**
     * An opened CJSB file: the wire root and a reader for its bufferViews.
     *
     * @typedef {object} GraphBinaryReader
     * @property {object} root Wire root from the JSON section.
     * @property {function(number, (string|null)=): ArrayBufferView} read Copies one bufferView into an owned typed array.
     */
    
    /**
     * Build a binary section without per-element typed-array decoding.
     *
     * @returns {GraphBinaryWriter} A fresh writer.
     * @throws {TypeError} When the host is big-endian.
     */
    static createBinaryWriter()
    {
                    CjsGraphBinaryFormat.requireLittleEndian();
                    const bufferViews = [];
                    const chunks = [];
                    let length = 0;
                    return {
                                    bufferViews,
                                    /**
                                        * Appends one typed payload at the next 8-byte boundary.
                                        *
                                        * @param {ArrayBufferView} value Payload whose class matches the type.
                                        * @param {string} type Scalar kind, or "bytes" for a Uint8Array.
                                        * @returns {number} The new bufferView index.
                                        * @throws {TypeError} When the payload class does not match the type.
                                        * @throws {RangeError} When the binary section exceeds 4 GiB.
                                        */
                                    write(value, type)
                                    {
                                                    const Ctor = TYPES.get(type);
                                                    if (!Ctor || !ArrayBuffer.isView(value)
                                                                    || (type === "bytes" ? !(value instanceof Uint8Array) : value.constructor !== Ctor)) throw new TypeError(`Expected '${type}' typed payload`);
                                                    const byteOffset = CjsGraphBinaryFormat._align8(length);
                                                    length = byteOffset + value.byteLength;
                                                    if (length > 0xffffffff) throw new RangeError("Binary section exceeds v1 limit");
                                                    const index = bufferViews.length;
                                                    bufferViews.push({ byteOffset, byteLength: value.byteLength, type, count: value.length });
                                                    chunks.push(bytes(value));
                                                    return index;
                                    },
                                    /**
                                        * Encodes the header, JSON envelope and binary section.
                                        *
                                        * @param {object} root Wire root.
                                        * @param {string} format Wire format identity.
                                        * @returns {Uint8Array} The CJSB file bytes.
                                        * @throws {RangeError} When the JSON section exceeds 4 GiB.
                                        */
                                    finish(root, format)
                                    {
                                                    const json = writeEnvelope({ format, version: 1, root, bufferViews });
                                                    if (json.byteLength > 0xffffffff) throw new RangeError("JSON section exceeds v1 limit");
                                                    const binStart = CjsGraphBinaryFormat._align8(16 + json.byteLength);
                                                    const result = new Uint8Array(binStart + length); // alloc: variable-length encoded file returned to the caller.
                                                    result.set(MAGIC);
                                                    const header = new DataView(result.buffer);
                                                    header.setUint32(4, 1, true);
                                                    header.setUint32(8, json.byteLength, true);
                                                    header.setUint32(12, length, true);
                                                    result.set(json, 16);
                                                    for (let index = 0; index < chunks.length; index++) result.set(chunks[index], binStart + bufferViews[index].byteOffset);
                                                    return result;
                                    }
                    };
    }

    /**
     * Validate framing once; bad individual views remain member-local failures when requested.
     *
     * @param {ArrayBuffer|ArrayBufferView} input CJSB file bytes.
     * @param {string} format Required wire format identity.
     * @returns {GraphBinaryReader} The wire root and view reader.
     * @throws {TypeError} When the header, padding or envelope is invalid.
     * @throws {RangeError} When the version or section lengths are invalid.
     */
    static openBinary(input, format)
    {
                    CjsGraphBinaryFormat.requireLittleEndian();
                    const source = bytes(input);
                    if (source.length < 16 || MAGIC.some((value, index) => source[index] !== value)) throw new TypeError("Invalid CJSB header");
                    const header = new DataView(source.buffer, source.byteOffset, source.byteLength);
                    if (header.getUint32(4, true) !== 1) throw new RangeError("Unsupported CJSB version");
                    const jsonLength = header.getUint32(8, true);
                    const binLength = header.getUint32(12, true);
                    const binStart = CjsGraphBinaryFormat._align8(16 + jsonLength);
                    if (binStart + binLength !== source.byteLength) throw new RangeError("CJSB section length mismatch");
                    for (let index = 16 + jsonLength; index < binStart; index++)
                    {
                                    if (source[index] !== 0) throw new TypeError("Nonzero CJSB JSON padding");
                    }
                    const envelope = readEnvelope(source.subarray(16, 16 + jsonLength), format);
                    if (!Array.isArray(envelope.bufferViews)) throw new TypeError("Missing bufferViews");
                    return {
                                    root: envelope.root,
                                    /**
                                        * Copies one bufferView into an owned typed array.
                                        *
                                        * @param {number} index bufferView index.
                                        * @param {string|null} [type=null] Required view type, or null for any.
                                        * @returns {ArrayBufferView} The typed array declared by the view.
                                        * @throws {RangeError} When the index, range, alignment or count is invalid.
                                        * @throws {TypeError} When the view type is unknown or does not match.
                                        */
                                    read(index, type = null)
                                    {
                                                    if (!Number.isSafeInteger(index) || index < 0 || index >= envelope.bufferViews.length) throw new RangeError("Invalid bufferView index");
                                                    const view = envelope.bufferViews[index];
                                                    if (!isRecord(view) || !TYPES.has(view.type)) throw new TypeError("Unknown bufferView type");
                                                    if (type !== null && view.type !== type) throw new TypeError(`bufferView type '${view.type}' does not match '${type}'`);
                                                    const Ctor = TYPES.get(view.type);
                                                    const { byteOffset, byteLength, count } = view;
                                                    if (![byteOffset, byteLength, count].every(value => Number.isSafeInteger(value) && value >= 0)
                                                                    || byteOffset % 8 !== 0 || !Number.isSafeInteger(count * Ctor.BYTES_PER_ELEMENT)
                                                                    || byteLength !== count * Ctor.BYTES_PER_ELEMENT || byteOffset + byteLength > binLength)
                                                    {
                                                                    throw new RangeError("Invalid bufferView range, alignment or count");
                                                    }
                                                    // A byte copy preserves bits and owns aligned storage even when the input is a slice.
                                                    const owned = source.slice(binStart + byteOffset, binStart + byteOffset + byteLength);
                                                    return new Ctor(owned.buffer, owned.byteOffset, count);
                                    }
                    };
    }

    /**
     * Binary's own typed-array handler never sends bulk elements through JSON scalar handlers.
     *
     * @param {unknown} value Typed array when writing, `_view` wrapper when reading.
     * @param {import("../../graph/core/dataTypes.js").GraphDataType} type Declared typed-array type.
     * @param {import("../../graph/core/dataTypes.js").GraphHandlerContext} context Handler context; `context.options.binary` is the writer or reader.
     * @returns {{_view: number}|ArrayBufferView} The view wrapper when writing, the typed array when reading.
     * @throws {TypeError} When the value does not match the declared array.
     */
    static binaryArray(value, type, context)
    {
                    const [Ctor, kind] = arrayType(type);
                    if (context.writing)
                    {
                                    if (!ArrayBuffer.isView(value) || value.constructor !== Ctor) throw new TypeError(`Expected declared '${kind}' typed array`);
                                    return { _view: context.options.binary.write(value, kind) };
                    }
                    if (!isRecord(value) || Object.keys(value).length !== 1) throw new TypeError("Expected _view wrapper");
                    return context.options.binary.read(value._view, kind);
    }

    /**
     * Explicit typed JS payloads make class-free producer storage unambiguous.
     *
     * @param {unknown} value Plain value, typed array or `{_custom, bytes}` wrapper.
     * @param {GraphBinaryWriter} binary Writer that receives typed payloads.
     * @returns {unknown} The value, or its `_view` wire wrapper.
     * @throws {TypeError} When the value is a caller-authored view, a malformed wrapper or an unsupported view.
     */
    static writePayload(value, binary)
    {
                    if (isRecord(value) && Object.hasOwn(value, "_view")) throw new TypeError("Caller-authored _view requires an owned typed payload");
                    if (isRecord(value) && Object.hasOwn(value, "_custom") && Object.hasOwn(value, "bytes"))
                    {
                                    if (Object.keys(value).length !== 2 || typeof value._custom !== "string" || !value._custom) throw new TypeError("Invalid opaque payload wrapper");
                                    return { _custom: value._custom, _view: binary.write(value.bytes, "bytes") };
                    }
                    if (!ArrayBuffer.isView(value)) return value;
                    for (const [Ctor, type] of Object.values(ARRAYS))
                    {
                                    if (value.constructor === Ctor) return { _view: binary.write(value, type) };
                    }
                    throw new TypeError("Unsupported binary payload view");
    }
}
import { CjsFormat } from "../../../../resource/format/CjsFormat.js";

