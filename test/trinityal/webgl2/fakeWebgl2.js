// A WebGL2RenderingContext stand-in for the WebGL backend's unit tests.
//
// It records every call and keeps buffer contents, so a test can assert both
// what the backend asked the device to do and what bytes ended up where. It is
// not a GL implementation. Buffer bindings enforce WebGL2's index/other-data
// distinction and retain element bindings per VAO; other validation is left
// to each test and the real-device checks.

let nextEnum = 0x9000;

/** The enums the backend reads off the context. Values are arbitrary but distinct. */
const ENUMS = [
    "ARRAY_BUFFER", "ELEMENT_ARRAY_BUFFER", "COPY_READ_BUFFER", "COPY_WRITE_BUFFER", "UNIFORM_BUFFER",
    "STATIC_DRAW", "DYNAMIC_DRAW",
    "VERTEX_ARRAY_BINDING", "ARRAY_BUFFER_BINDING", "ELEMENT_ARRAY_BUFFER_BINDING", "TEXTURE_BINDING_2D",
    "TEXTURE_2D", "TEXTURE_MIN_FILTER", "TEXTURE_MAG_FILTER", "NEAREST",
    "R32F", "RED", "FLOAT", "R32UI", "RED_INTEGER", "UNSIGNED_INT", "R32I", "INT",
    "RGBA32F", "RGBA", "RGBA32UI", "RGBA_INTEGER",
    "REPEAT", "MIRRORED_REPEAT", "CLAMP_TO_EDGE", "LINEAR",
    "NEAREST_MIPMAP_NEAREST", "NEAREST_MIPMAP_LINEAR", "LINEAR_MIPMAP_NEAREST", "LINEAR_MIPMAP_LINEAR",
    "TEXTURE_WRAP_S", "TEXTURE_WRAP_T", "TEXTURE_WRAP_R", "TEXTURE_MIN_LOD", "TEXTURE_MAX_LOD",
    "TEXTURE_COMPARE_MODE", "TEXTURE_COMPARE_FUNC", "COMPARE_REF_TO_TEXTURE",
    "INVALID_INDEX", "CURRENT_PROGRAM", "VERTEX_SHADER", "FRAGMENT_SHADER", "COMPILE_STATUS", "LINK_STATUS", "ACTIVE_ATTRIBUTES",
    "FLOAT_VEC2", "FLOAT_VEC3", "FLOAT_VEC4", "INT_VEC2", "INT_VEC3", "INT_VEC4",
    "UNSIGNED_INT_VEC2", "UNSIGNED_INT_VEC3", "UNSIGNED_INT_VEC4"
];

/** `EXT_disjoint_timer_query_webgl2`'s enums, with their real values; offered when a test lists it in `gl.extensions`. */
export const TIMER_QUERY = Object.freeze({ TIME_ELAPSED_EXT: 0x88BF, GPU_DISJOINT_EXT: 0x8FBB });

/**
 * Builds a fake context.
 *
 * @returns {{gl: object, calls: Array}} The context and its call log.
 */
export function FakeWebgl2()
{
    const calls = [];
    const bindings = new Map();
    const elementBindings = new Map();
    const gl = { calls };

    for (const name of ENUMS) gl[name] = nextEnum++;

    let vertexArray = null;

    Object.assign(gl, {
        createBuffer()
        {
            const buffer = { kind: "buffer", bytes: new Uint8Array(0), usage: 0, type: 0 };
            calls.push([ "createBuffer", buffer ]);
            return buffer;
        },
        deleteBuffer(buffer) { calls.push([ "deleteBuffer", buffer ]); },
        bindBuffer(target, buffer)
        {
            if (buffer)
            {
                const copyTarget = target === gl.COPY_READ_BUFFER || target === gl.COPY_WRITE_BUFFER;
                const type = target === gl.ELEMENT_ARRAY_BUFFER ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER;
                if (buffer.type && !copyTarget && buffer.type !== type)
                {
                    throw new Error("INVALID_OPERATION: incompatible element array buffer target");
                }
                if (!buffer.type) buffer.type = type;
            }
            if (target === gl.ELEMENT_ARRAY_BUFFER) elementBindings.set(vertexArray, buffer);
            bindings.set(target, buffer);
            calls.push([ "bindBuffer", target, buffer ]);
        },
        bufferData(target, data, usage)
        {
            const buffer = bindings.get(target);
            // A size allocates zeroed storage, as GL's bufferData(target, size, usage) does.
            buffer.bytes = typeof data === "number" ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice();
            buffer.usage = usage;
            calls.push([ "bufferData", target, buffer, buffer.bytes.slice(), usage ]);
        },
        bufferSubData(target, offset, data, sourceOffset = 0, length = 0)
        {
            const buffer = bindings.get(target);
            const elementSize = data.BYTES_PER_ELEMENT ?? 1;
            const byteOffset = sourceOffset * elementSize;
            const byteLength = length ? length * elementSize : data.byteLength - byteOffset;
            const bytes = new Uint8Array(data.buffer, data.byteOffset + byteOffset, byteLength);
            buffer.bytes.set(bytes, offset);
            calls.push([ "bufferSubData", target, buffer, offset, bytes.slice() ]);
        },
        copyBufferSubData(readTarget, writeTarget, readOffset, writeOffset, size)
        {
            const source = bindings.get(readTarget);
            const destination = bindings.get(writeTarget);
            if (source.type !== destination.type) throw new Error("INVALID_OPERATION: incompatible buffer copy types");
            destination.bytes.set(source.bytes.subarray(readOffset, readOffset + size), writeOffset);
            calls.push([ "copyBufferSubData", readTarget, writeTarget, readOffset, writeOffset, size ]);
        },
        getBufferSubData(target, offset, view)
        {
            const buffer = bindings.get(target);
            view.set(buffer.bytes.subarray(offset, offset + view.length));
            calls.push([ "getBufferSubData", target, buffer, offset, view.length ]);
        },
        createTexture()
        {
            const texture = { kind: "texture" };
            calls.push([ "createTexture", texture ]);
            return texture;
        },
        deleteTexture(texture) { calls.push([ "deleteTexture", texture ]); },
        bindTexture(target, texture)
        {
            bindings.set(target, texture);
            calls.push([ "bindTexture", target, texture ]);
        },
        texImage2D(...args) { calls.push([ "texImage2D", bindings.get(gl.TEXTURE_2D), ...args ]); },
        texParameteri(...args) { calls.push([ "texParameteri", ...args ]); },
        createSampler()
        {
            const sampler = { kind: "sampler", parameters: new Map() };
            calls.push([ "createSampler", sampler ]);
            return sampler;
        },
        deleteSampler(sampler) { calls.push([ "deleteSampler", sampler ]); },
        samplerParameteri(sampler, name, value) { sampler.parameters.set(name, value); },
        samplerParameterf(sampler, name, value) { sampler.parameters.set(name, value); },
        getExtension(name) { return gl.extensions?.[name] ?? null; },
        bindVertexArray(array)
        {
            vertexArray = array;
            bindings.set(gl.ELEMENT_ARRAY_BUFFER, elementBindings.get(array) ?? null);
            calls.push([ "bindVertexArray", array ]);
        },
        getParameter(name)
        {
            if (name === gl.VERTEX_ARRAY_BINDING) return vertexArray;
            if (name === gl.ARRAY_BUFFER_BINDING) return bindings.get(gl.ARRAY_BUFFER) ?? null;
            if (name === gl.ELEMENT_ARRAY_BUFFER_BINDING) return bindings.get(gl.ELEMENT_ARRAY_BUFFER) ?? null;
            if (name === gl.TEXTURE_BINDING_2D) return bindings.get(gl.TEXTURE_2D) ?? null;
            if (name === gl.CURRENT_PROGRAM) return bindings.get("program") ?? null;
            if (name === TIMER_QUERY.GPU_DISJOINT_EXT) return gl.disjoint === true;
            return null;
        },
        texStorage2D(...args) { calls.push([ "texStorage2D", ...args ]); },
        texStorage3D(...args) { calls.push([ "texStorage3D", ...args ]); },
        texSubImage2D(...args) { calls.push([ "texSubImage2D", ...args ]); },
        texSubImage3D(...args) { calls.push([ "texSubImage3D", ...args ]); },
        compressedTexSubImage2D(...args) { calls.push([ "compressedTexSubImage2D", ...args ]); },
        compressedTexSubImage3D(...args) { calls.push([ "compressedTexSubImage3D", ...args ]); },
        pixelStorei(...args) { calls.push([ "pixelStorei", ...args ]); },
        generateMipmap(...args) { calls.push([ "generateMipmap", ...args ]); },
        createRenderbuffer()
        {
            const renderbuffer = { kind: "renderbuffer" };
            calls.push([ "createRenderbuffer", renderbuffer ]);
            return renderbuffer;
        },
        deleteRenderbuffer(renderbuffer) { calls.push([ "deleteRenderbuffer", renderbuffer ]); },
        bindRenderbuffer(...args) { calls.push([ "bindRenderbuffer", ...args ]); },
        renderbufferStorageMultisample(...args) { calls.push([ "renderbufferStorageMultisample", ...args ]); },
        createShader(type)
        {
            const shader = { kind: "shader", type, source: "" };
            calls.push([ "createShader", shader ]);
            return shader;
        },
        shaderSource(shader, source) { shader.source = source; },
        compileShader(shader) { calls.push([ "compileShader", shader ]); },
        // A shader whose source contains "#error" fails to compile, so tests can
        // exercise the failure path.
        getShaderParameter(shader) { return !shader.source.includes("#error"); },
        getShaderInfoLog(shader) { return shader.source.includes("#error") ? "ERROR: 0:1: '#error'" : ""; },
        deleteShader(shader) { calls.push([ "deleteShader", shader ]); },
        createProgram()
        {
            const program = { kind: "program", shaders: [], attributes: new Map(), uniforms: new Map() };
            calls.push([ "createProgram", program ]);
            return program;
        },
        attachShader(program, shader) { program.shaders.push(shader); },
        bindAttribLocation(program, location, name) { program.attributes.set(name, location); },
        linkProgram(program)
        {
            program.activeAttributes = [];
            const types = { float: gl.FLOAT, vec2: gl.FLOAT_VEC2, vec3: gl.FLOAT_VEC3, vec4: gl.FLOAT_VEC4,
                int: gl.INT, ivec2: gl.INT_VEC2, ivec3: gl.INT_VEC3, ivec4: gl.INT_VEC4,
                uint: gl.UNSIGNED_INT, uvec2: gl.UNSIGNED_INT_VEC2, uvec3: gl.UNSIGNED_INT_VEC3, uvec4: gl.UNSIGNED_INT_VEC4 };
            for (const shader of program.shaders)
            {
                if (shader.type !== gl.VERTEX_SHADER) continue;
                const declarations = shader.source.matchAll(/\bin\s+(?:(?:lowp|mediump|highp)\s+)?(float|vec[234]|int|ivec[234]|uint|uvec[234])\s+(\w+)\s*;/gu);
                for (const declaration of declarations)
                {
                    const name = declaration[2];
                    if (!program.attributes.has(name)) program.attributes.set(name, program.activeAttributes.length);
                    program.activeAttributes.push({ name, size: 1, type: types[declaration[1]] });
                }
            }
            calls.push([ "linkProgram", program ]);
        },
        getProgramParameter(program, name)
        {
            if (name === gl.ACTIVE_ATTRIBUTES) return program.activeAttributes.length;
            return !program.shaders.some(shader => shader.source.includes("#nolink"));
        },
        getActiveAttrib(program, index)
        {
            calls.push([ "getActiveAttrib", program, index ]);
            return program.activeAttributes[index] ?? null;
        },
        getAttribLocation(program, name) { return program.attributes.get(name) ?? -1; },
        getProgramInfoLog() { return "link failed"; },
        getFragDataLocation(program, name)
        {
            for (const shader of program.shaders)
            {
                if (shader.type !== gl.FRAGMENT_SHADER) continue;
                const outputs = shader.source.matchAll(/(?:layout\s*\(\s*location\s*=\s*(\d+)\s*\)\s*)?out\s+\w+\s+(\w+)\s*;/gu);
                for (const output of outputs)
                {
                    if (output[2] === name) return Number(output[1] ?? 0);
                }
            }
            return -1;
        },
        deleteProgram(program) { calls.push([ "deleteProgram", program ]); },
        useProgram(program)
        {
            bindings.set("program", program);
            calls.push([ "useProgram", program ]);
        },
        getUniformLocation(program, name)
        {
            // Every uniform named in any attached shader's source exists.
            if (!program.shaders.some(shader => shader.source.includes(name))) return null;
            if (!program.uniforms.has(name)) program.uniforms.set(name, { kind: "location", name });
            return program.uniforms.get(name);
        },
        uniform1i(location, value) { calls.push([ "uniform1i", location.name, value ]); },
        getUniformBlockIndex(program, name)
        {
            return program.shaders.some(shader => shader.source.includes(`uniform ${name}`)) ? name.length : gl.INVALID_INDEX;
        },
        uniformBlockBinding(program, index, point) { calls.push([ "uniformBlockBinding", index, point ]); },
        createFramebuffer() { return { kind: "framebuffer" }; },
        deleteFramebuffer() {},
        bindFramebuffer(...args) { calls.push([ "bindFramebuffer", ...args ]); },
        drawBuffers(buffers) { calls.push([ "drawBuffers", Array.from(buffers) ]); },
        // A sync object signals when a test sets `signaled`; `finish` signals them all.
        fenceSync(condition, flags)
        {
            const sync = { kind: "sync", condition, flags, signaled: false };
            syncs.add(sync);
            calls.push([ "fenceSync", sync ]);
            return sync;
        },
        deleteSync(sync)
        {
            syncs.delete(sync);
            calls.push([ "deleteSync", sync ]);
        },
        getSyncParameter(sync, name)
        {
            return name === withEnums.SYNC_STATUS ? (sync.signaled ? withEnums.SIGNALED : withEnums.UNSIGNALED) : null;
        },
        finish()
        {
            for (const sync of syncs) sync.signaled = true;
            calls.push([ "finish" ]);
        },
        // A query's result arrives when a test sets `available` and `result`.
        createQuery()
        {
            const query = { kind: "query", available: false, result: 0 };
            calls.push([ "createQuery", query ]);
            return query;
        },
        deleteQuery(query) { calls.push([ "deleteQuery", query ]); },
        beginQuery(target, query)
        {
            activeQueries.set(target, query);
            calls.push([ "beginQuery", target, query ]);
        },
        endQuery(target)
        {
            activeQueries.delete(target);
            calls.push([ "endQuery", target ]);
        },
        getQuery(target) { return activeQueries.get(target) ?? null; },
        getQueryParameter(query, name)
        {
            if (name === withEnums.QUERY_RESULT_AVAILABLE) return query.available;
            if (name === withEnums.QUERY_RESULT) return query.result;
            return null;
        }
    });

    const syncs = new Set();
    const activeQueries = new Map();

    // The canvas the drawing buffer belongs to, and context loss, which a test
    // may set.
    gl.canvas = { width: 300, height: 150 };
    gl.lost = false;
    gl.isContextLost = () => gl.lost;
    Object.defineProperty(gl, "drawingBufferWidth", { get: () => gl.canvas.width });
    Object.defineProperty(gl, "drawingBufferHeight", { get: () => gl.canvas.height });

    // Any other upper-case constant the backend reads gets its own stable value,
    // so tests need not list every enum a texture path touches. Any other
    // lower-case method is recorded and does nothing, so state-setting calls
    // (enable, blendFuncSeparate, viewport...) can be asserted from the log.
    const withEnums = new Proxy(gl, {
        get(target, name)
        {
            if (!(name in target) && typeof name === "string" && /^[A-Z][A-Z0-9_]*$/u.test(name)) target[name] = nextEnum++;
            // "then" stays absent, or anything awaiting the context would hang.
            if (!(name in target) && typeof name === "string" && name !== "then" && name !== "toJSON" && /^[a-z][A-Za-z0-9]*$/u.test(name))
            {
                target[name] = (...args) => { calls.push([ name, ...args ]); };
            }
            return target[name];
        }
    });

    return { gl: withEnums, calls };
}

/**
 * A render context stand-in: the resources ask it only for validity and the
 * WebGL2 context.
 *
 * @param {object} gl The fake context.
 * @param {boolean} [valid] Whether the context reports itself valid.
 * @returns {object} The render context.
 */
export function FakeRenderContext(gl, valid = true)
{
    return { IsValid: () => valid, GetWebgl2: () => gl };
}
