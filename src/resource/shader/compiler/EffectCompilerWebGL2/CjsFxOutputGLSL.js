// Not in Carbon: the GLSL ES 3.00 printer of the WebGL2 target, run on the same
// tree as CjsFxOutputWGSL.js, after the same passes, and laid out like it so the
// two read side by side. It shares no code with DxbcGlslEmitter, whose output
// is ccpwgl's interface: this one prints source, not bytecode, and only the
// WebGL2 AL reads it.
//
// What the AL needs from a program (Tr2ShaderProgramALWebgl2.js):
// - a constant buffer is `uniform vec4 <name>[N]`, set whole with `uniform4fv`,
//   and a member read is a read of its HLSL-packed registers;
// - a texture is one sampler uniform, so D3D's separate sampler leaves the
//   program and is recorded instead, per texture, as `pairedSamplerRegisters`;
// - vertex inputs are `in_<SEMANTIC><index>`, and the AL binds each to the
//   location of its register before linking;
// - a vertex-stage structured buffer is the `CjsSb<r>Block` uniform block the AL
//   fills from the object's bone palette, `vec4 data[]` by register;
// - pixel outputs are `layout(location = N)`;
// - every vertex stage ends in the clip tail below.
//
// Constant buffers are named per stage (`vs_cb1`, `ps_cb2`) because two stages
// declaring one uniform name must declare it at one size, and a register does
// not promise that. Varyings are `v_<SEMANTIC><index>`: GLSL ES 3.00 links them
// by name, which does what the WGSL's numbered `@location`s do.
//
// GLSL does some of what WGSL makes the printer do: parameters are writable,
// swizzles are assignable, `out` parameters are references, and a `const` is a
// constant expression wherever a texture offset wants one. Others go the other
// way: vector comparisons and logic are functions, and `main` returns nothing,
// so PatchShader's wrapper prints as `cjs_entry` and `main` carries the stage's
// inputs and outputs to and from it.

import { HLSLParserTokens } from "../hlslParserTokens.js";
import { Type } from "../Type.js";
import { CjsFxGlslTypes } from "./CjsFxGlslTypes.js";
import { CjsFxHlslPacking } from "../EffectCompilerWebGPU/CjsFxHlslPacking.js";
import {
    ASSIGNMENT, BINARY, COMPARISONS, isReferenceParam, literal, nodeName, normaliseComponent, registerOf, scalarOf, shapeOf,
    typeOf, withComponent
} from "../EffectCompilerWebGPU/CjsFxOutputWGSL.js";
import { MetalSystemSemanticsType } from "../EffectCompilerMetal/MetalSystemSemanticsType.js";
import { ASTNode } from "../ASTNode/ASTNode.js";
import { Symbol } from "../SymbolTable/Symbol.js";

const T = HLSLParserTokens;
const N = ASTNode.ASTNodeType;
const E = MetalSystemSemanticsType.Enum;

/** HLSL intrinsics GLSL has under the same or another name, with the same arguments. */
const INTRINSICS = new Map([
    ["abs", "abs"], ["acos", "acos"], ["asin", "asin"], ["atan", "atan"], ["atan2", "atan"], ["ceil", "ceil"],
    ["clamp", "clamp"], ["cos", "cos"], ["cosh", "cosh"], ["ddx", "dFdx"], ["ddy", "dFdy"], ["ddx_coarse", "dFdx"],
    ["ddy_coarse", "dFdy"], ["ddx_fine", "dFdx"], ["ddy_fine", "dFdy"], ["degrees", "degrees"], ["exp", "exp"],
    ["exp2", "exp2"], ["floor", "floor"], ["frac", "fract"], ["fwidth", "fwidth"], ["lerp", "mix"], ["log", "log"],
    ["log2", "log2"], ["max", "max"], ["min", "min"], ["pow", "pow"], ["radians", "radians"], ["round", "round"],
    ["rsqrt", "inversesqrt"], ["sin", "sin"], ["sinh", "sinh"], ["smoothstep", "smoothstep"], ["sqrt", "sqrt"],
    ["step", "step"], ["tan", "tan"], ["tanh", "tanh"], ["trunc", "trunc"]
]);

/** The function of a vector comparison, by token. */
const VECTOR_COMPARISONS = new Map([
    [T.OP_LESS, "lessThan"], [T.OP_MORE, "greaterThan"], [T.OP_LE_OP, "lessThanEqual"], [T.OP_GE_OP, "greaterThanEqual"],
    [T.OP_EQ_OP, "equal"], [T.OP_NE_OP, "notEqual"]
]);

/** The texture types a stage may declare, each given a precision, as GLSL ES 3.00 requires of some and allows of all. */
const SAMPLER_TYPES = [
    "sampler2D", "sampler3D", "samplerCube", "sampler2DArray", "isampler2D", "isampler3D", "isamplerCube",
    "isampler2DArray", "usampler2D", "usampler3D", "usamplerCube", "usampler2DArray"
];

/** Vertex semantics, by the `name` RemapVertexInputSemanticsDXToMetal records (EffectCompilerMetal.js VS_SEMANTICS). */
const VERTEX_SEMANTICS = ["POSITION", "COLOR", "NORMAL", "TANGENT", "BINORMAL", "TEXCOORD", "BLENDINDICES", "BLENDWEIGHT"];

/** Elements of a vertex-stage structured buffer: Carbon's most joints, the AL's `BONE_BLOCK_CAPACITY`. */
const VERTEX_STRUCTURED_CAPACITY = 69;

/** Texels to a data texture's row: the AL's `DATA_TEXTURE_WIDTH` and the emitter's `dataTextureWidth`. */
const DATA_TEXTURE_WIDTH = 2048;

/** The vertex stage's tail, after the source's clip position. See Tr2RenderContextALWebgl2's `ssyf`. */
const CLIP_TAIL = [
    "    gl_Position.xy += ssyf.xy * gl_Position.w;",
    "    gl_Position.y *= ssyf.z;",
    "    gl_Position.z = 2.0 * gl_Position.z - gl_Position.w;"
];

/**
 * The GLSL ES 3.00 text of one stage, and what the WebGL2 AL needs to bind it.
 */
export class CjsFxOutputGLSL
{
    /** Stable name independent of minification; no registry is required. */
    static className = "CjsFxOutputGLSL";

    /** The parse. @type {import("../ParserState/ParserState.js").ParserState|null} */
    _state = null;

    /** The stage kind. @type {"vertex"|"fragment"|null} */
    _stage = null;

    /** PatchShader's wrapper, printed as `cjs_entry`. @type {import("../ASTNode/ASTNode.js").ASTNode|null} */
    _entry = null;

    /** The struct symbols laid out over used members only. @type {Set<object>|null} */
    _globalsStructs = null;

    /** The stage's pipeline inputs: a vertex input's semantic is only here once its register is set. @type {object[]} */
    _pipelineInputs = [];

    /** Constant buffers by struct symbol. @type {Map<object, { name: string, layout: { size: number, members: Map } }>} */
    _cbuffers = new Map();

    /** Generated helper functions by name. @type {Map<string, string>} */
    _helpers = new Map();

    /** Counter for temporaries. */
    _temps = 0;

    /** The parameters this printer leaves out, as module-scope uniforms stand for them. @type {Set<object>} */
    _moduleScopeParams = new Set();

    /** The return type of the function being printed, or null outside one. @type {Type|null} */
    _returnType = null;

    /** The stage's backend-block bindings. @type {object[]} */
    _bindings = [];

    /** The texture bindings by uniform name. @type {Map<string, object>} */
    _textures = new Map();

    /** The sampler registers by the sampler's name. @type {Map<string, number>} */
    _samplers = new Map();

    /** Generated structured-buffer readers by the element's struct symbol. @type {Map<object, string>} */
    _structReaders = new Map();

    /** Structured buffers by name: their block and the element's registers. @type {Map<string, { block: string, rows: number }>} */
    _structured = new Map();

    /** The stage's vertex inputs for the backend block. @type {object[]} */
    _stageInputs = [];

    /** The stage's pixel outputs for the backend block. @type {object[]} */
    _stageOutputs = [];

    /** Declarations of the stage's `in` and `out` variables. @type {string[]} */
    _ioDeclarations = [];

    /** The lines of `main` before the call to the entry. @type {string[]} */
    _mainInputs = [];

    /** The lines of `main` after the call to the entry. @type {string[]} */
    _mainOutputs = [];

    /**
     * @param {object} options The stage.
     * @param {import("../ParserState/ParserState.js").ParserState} options.state The parse, after the target's passes; used symbols are marked for this stage.
     * @param {"vertex"|"fragment"} options.stage The stage kind.
     * @param {import("../ASTNode/ASTNode.js").ASTNode} options.entry The `NT_FUNCTION_DEFINITION` PatchShader made.
     * @param {Set<object>} [options.globalsStructs] The struct symbols laid out over used members only.
     * @param {object[]} [options.pipelineInputs] The stage's `PipelineInputDescription`s.
     */
    constructor({ state, stage, entry, globalsStructs = new Set(), pipelineInputs = [] })
    {
        this._state = state;

        this._stage = stage;

        this._entry = entry;

        this._globalsStructs = globalsStructs;

        this._pipelineInputs = pipelineInputs;
    }

    /**
     * Prints the stage.
     *
     * @returns {string} The GLSL source.
     */
    Write()
    {
        const uniforms = this._writeBindings();
        const entry = this._writeMainCall();
        const body = [];
        const structs = new Map();
        const root = this._state.GetTree();
        for (const node of root.GetChildren())
        {
            if (node === null)
            {
                continue;
            }
            switch (node.GetNodeType())
            {
                case N.NT_STRUCT:
                    structs.set(node.GetSymbol(), body.length);
                    body.push(this._writeStruct(node));
                    break;
                case N.NT_VAR_DECLARATION_LIST:
                    body.push(this._writeModuleDeclarations(node));
                    break;
                case N.NT_FUNCTION_DEFINITION:
                    body.push(node === this._entry ? this._writeEntry(node) : this._writeFunction(node));
                    break;
                default:
                    break;
            }
        }
        // GLSL declares before use, so an element reader follows its struct.
        for (const [ structSymbol, reader ] of this._structReaders)
        {
            body[structs.get(structSymbol)] += `\n\n${reader}`;
        }
        const head = ["#version 300 es", "precision highp float;", "precision highp int;", ...SAMPLER_TYPES.map(type => `precision highp ${type};`)];
        return [head.join("\n"), [...uniforms, ...this._ioDeclarations].join("\n"), ...this._helpers.values(), ...body, entry].filter(text => text !== "").join("\n\n") + "\n";
    }

    /**
     * What the WebGL2 AL binds this stage from: its entry in the pass's backend
     * block.
     *
     * @returns {{ bindings: object[], stageInputs: object[], stageOutputs: object[] }} The stage's record.
     */
    GetBlockStage()
    {
        return { bindings: this._bindings, stageInputs: this._stageInputs, stageOutputs: this._stageOutputs };
    }

    // ---------------------------------------------------------------------
    // Module scope
    // ---------------------------------------------------------------------

    /**
     * The uniforms of the resources the entry receives, from the wrapper's
     * registered parameters.
     *
     * @returns {string[]} The declarations.
     */
    _writeBindings()
    {
        const lines = [];
        const prefix = this._stage === "vertex" ? "vs" : "ps";
        const header = this._entry.GetChild(0);
        for (const param of header.GetChildren())
        {
            const symbol = param.GetSymbol();
            const reg = registerOf(symbol);
            if (reg === null)
            {
                continue;
            }
            const type = symbol.type;
            switch (reg.registerType)
            {
                case "c":
                {
                    const layout = this._layoutOf(type.symbol);
                    const name = `${prefix}_cb${reg.registerNumber}`;
                    const sizeInVec4 = Math.max(1, Math.ceil(layout.size / CjsFxHlslPacking.registerBytes));
                    this._bindings.push({ kind: "constantBuffer", registerIndex: reg.registerNumber, name, sizeInVec4, style: "array" });
                    this._cbuffers.set(type.symbol, { name, layout });
                    this._moduleScopeParams.add(symbol);
                    lines.push(`uniform vec4 ${name}[${sizeInVec4}];`);
                    break;
                }
                case "t":
                {
                    if (type.builtInType === T.OP_STRUCTUREDBUFFER)
                    {
                        lines.push(this._writeStructuredBlock(symbol, reg.registerNumber));
                        break;
                    }
                    const texture = type.IsTexture() ? CjsFxGlslTypes.glslTexture(type) : null;
                    if (texture === null)
                    {
                        throw new Error(`CjsFxOutputGLSL: ${symbol.name.ToString()} is a ${type.ToString()}, which is not supported yet`);
                    }
                    const name = this._nameOf(symbol);
                    const binding = { kind: "resource", registerIndex: reg.registerNumber, name, dimensionName: texture.dimensionName, pairedSamplerRegisters: [] };
                    this._bindings.push(binding);
                    this._textures.set(name, binding);
                    this._moduleScopeParams.add(symbol);
                    lines.push(`uniform ${texture.sampler} ${name};`);
                    break;
                }
                case "s":
                    this._samplers.set(this._nameOf(symbol), reg.registerNumber);
                    this._moduleScopeParams.add(symbol);
                    break;
                case "i":
                case "v":
                    break;
                default:
                    throw new Error(`CjsFxOutputGLSL: ${symbol.name.ToString()} has a register GLSL does not bind yet (${reg.registerType})`);
            }
        }
        if (this._stage === "vertex")
        {
            lines.push("uniform vec3 ssyf;");
        }
        return lines;
    }

    /**
     * A structured buffer's declaration: a uniform block in the vertex stage, an
     * RGBA32UI data texture in the pixel stage, as the DXBC emitter lowers them.
     *
     * @param {object} symbol The buffer's symbol.
     * @param {number} register Its `t` register.
     * @returns {string} The declaration.
     */
    _writeStructuredBlock(symbol, register)
    {
        const rows = elementRows(symbol.type.templateParameter);
        if (this._stage !== "vertex")
        {
            const name = `sb${register}`;
            this._bindings.push({ kind: "structuredTexture", registerIndex: register, name, strideBytes: rows * 16, format: "RGBA32UI", width: DATA_TEXTURE_WIDTH });
            this._structured.set(this._nameOf(symbol), { block: name, rows, texture: true });
            this._moduleScopeParams.add(symbol);
            return `uniform highp usampler2D ${name};`;
        }
        const block = `CjsSb${register}`;
        this._bindings.push({ kind: "structuredUbo", registerIndex: register, name: block, strideBytes: rows * CjsFxHlslPacking.registerBytes, capacityElements: VERTEX_STRUCTURED_CAPACITY });
        this._structured.set(this._nameOf(symbol), { block, rows });
        this._moduleScopeParams.add(symbol);
        return `layout(std140) uniform ${block}Block\n{\n    vec4 data[${rows * VERTEX_STRUCTURED_CAPACITY}];\n} ${block};`;
    }

    /**
     * The constant-buffer layout of a struct: every member for a declared
     * constant buffer, only the used members for the synthesised globals.
     *
     * @param {object} structSymbol The struct's symbol.
     * @returns {{ size: number, members: Map<object, { offset: number, type: Type }> }} The layout.
     */
    _layoutOf(structSymbol)
    {
        return this._globalsStructs.has(structSymbol) ? CjsFxHlslPacking.usedMembersLayout(structSymbol) : CjsFxHlslPacking.structLayout(structSymbol);
    }

    /**
     * A struct definition, unless unused or only a constant buffer's layout.
     *
     * @param {import("../ASTNode/ASTNode.js").ASTNode} node The `NT_STRUCT`.
     * @returns {string} The definition, or "".
     */
    _writeStruct(node)
    {
        const symbol = node.GetSymbol();
        if (!symbol.used || this._cbuffers.has(symbol) || this._globalsStructs.has(symbol))
        {
            return "";
        }
        const members = [];
        for (const memberNode of node.GetChildren())
        {
            for (const nameNode of memberNode.GetChildren())
            {
                const member = nameNode.GetSymbol();
                members.push(`    ${CjsFxGlslTypes.glslType(member.type, s => this._nameOf(s))} ${this._nameOf(member)};`);
            }
        }
        return `struct ${this._nameOf(symbol)}\n{\n${members.join("\n")}\n};`;
    }

    /**
     * Module-scope declarations: constants and private variables.
     *
     * @param {import("../ASTNode/ASTNode.js").ASTNode} node The `NT_VAR_DECLARATION_LIST`.
     * @returns {string} The declarations, or "".
     */
    _writeModuleDeclarations(node)
    {
        const lines = [];
        for (const nameNode of node.GetChildren())
        {
            const symbol = nameNode.GetSymbol();
            if (!symbol || !symbol.used)
            {
                continue;
            }
            const type = CjsFxGlslTypes.glslType(symbol.type, s => this._nameOf(s));
            const init = nameNode.GetChildOrNull(1);
            const qualifier = symbol.addressSpace === Symbol.AddressSpace.Constant && init ? "const " : "";
            lines.push(`${qualifier}${type} ${this._nameOf(symbol)}${init ? ` = ${this._initializer(init, symbol.type)}` : ""};`);
        }
        return lines.join("\n");
    }

    // ---------------------------------------------------------------------
    // Stage inputs and outputs
    // ---------------------------------------------------------------------

    /**
     * `main`: fills the entry's inputs from the stage's, calls it, and writes
     * its result to the stage's outputs. Everything the stage declares for
     * them is gathered here, before the body prints.
     *
     * @returns {string} The function.
     */
    _writeMainCall()
    {
        const header = this._entry.GetChild(0);
        const args = [];
        for (const param of header.GetChildren())
        {
            const symbol = param.GetSymbol();
            const reg = registerOf(symbol);
            if (reg !== null && reg.registerType === "v")
            {
                if (reg.registerNumber !== E.base_vertex && reg.registerNumber !== E.base_instance)
                {
                    args.push(this._systemInput(reg.registerNumber, symbol.type));
                }
                continue;
            }
            if (reg !== null && reg.registerType !== "i")
            {
                continue;
            }
            const type = CjsFxGlslTypes.glslType(symbol.type, s => this._nameOf(s));
            const name = this._nameOf(symbol);
            this._mainInputs.push(`    ${type} ${name};`);
            for (const member of membersOf(symbol.type))
            {
                this._mainInputs.push(`    ${name}.${this._nameOf(member)} = ${this._inputOf(member)};`);
            }
            args.push(name);
        }

        const returnType = header.GetType();
        let call = `    cjs_entry(${args.join(", ")});`;
        if (returnType.builtInType !== T.OP_VOID)
        {
            call = `    ${CjsFxGlslTypes.glslType(returnType, s => this._nameOf(s))} cjs_result = cjs_entry(${args.join(", ")});`;
            for (const member of membersOf(returnType))
            {
                this._mainOutputs.push(`    ${this._outputOf(member)} = cjs_result.${this._nameOf(member)};`);
            }
        }
        if (this._stage === "vertex")
        {
            this._mainOutputs.push(...CLIP_TAIL);
        }
        return `void main()\n{\n${[...this._mainInputs, call, ...this._mainOutputs].join("\n")}\n}`;
    }

    /**
     * The stage input behind a member of the entry's input struct, declared
     * here.
     *
     * @param {object} member The member's symbol.
     * @returns {string} The expression.
     */
    _inputOf(member)
    {
        const reg = registerOf(member);
        const type = CjsFxGlslTypes.glslType(member.type, s => this._nameOf(s));
        if (reg !== null && reg.registerType === "v")
        {
            return this._systemInput(reg.registerNumber, member.type);
        }
        if (reg !== null && reg.registerType === "a")
        {
            const input = this._pipelineInputs.find(item => item.registerIndex === reg.registerNumber);
            const semanticName = VERTEX_SEMANTICS[input.name];
            const semanticIndex = input.index;
            const name = `in_${semanticName}${semanticIndex}`;
            this._stageInputs.push({
                register: reg.registerNumber, name, semanticName, semanticIndex,
                componentTypeName: member.type.builtInType === T.OP_INT ? "int32" : member.type.builtInType === T.OP_UINT ? "uint32" : "float32",
                mask: (1 << member.type.width) - 1
            });
            this._ioDeclarations.push(`in ${type} ${name};`);
            return name;
        }
        if (reg !== null && reg.registerType === "x")
        {
            const name = varyingName(member);
            this._ioDeclarations.push(`${interpolationOf(member)}in ${type} ${name};`);
            return name;
        }
        throw new Error(`CjsFxOutputGLSL: stage input ${member.name.ToString()} has no register GLSL can read`);
    }

    /**
     * The stage output behind a member of the entry's result, declared here.
     *
     * @param {object} member The member's symbol.
     * @returns {string} The assignable expression.
     */
    _outputOf(member)
    {
        const reg = registerOf(member);
        const type = CjsFxGlslTypes.glslType(member.type, s => this._nameOf(s));
        if (reg !== null && reg.registerType === "x" && this._stage === "vertex")
        {
            const name = varyingName(member);
            this._ioDeclarations.push(`${interpolationOf(member)}out ${type} ${name};`);
            return name;
        }
        if (reg !== null && reg.registerType === "v")
        {
            const system = reg.registerNumber;
            if (system >= E.color_0 && system <= E.color_7)
            {
                const location = system - E.color_0;
                const name = `out_SV_Target${location}`;
                this._stageOutputs.push({ register: location, name, width: member.type.width, semanticName: "SV_Target", semanticIndex: location });
                this._ioDeclarations.push(`layout(location = ${location}) out ${type} ${name};`);
                return name;
            }
            switch (system)
            {
                case E.position:
                    return "gl_Position";
                case E.position_invariant:
                    this._ioDeclarations.push("invariant gl_Position;");
                    return "gl_Position";
                case E.depth:
                    return "gl_FragDepth";
                default:
                    break;
            }
        }
        throw new Error(`CjsFxOutputGLSL: stage output ${member.name.ToString()} has no register GLSL can write`);
    }

    /**
     * The GLSL expression of a Metal system register read in a stage.
     *
     * SV_Position's w is clip w, where `gl_FragCoord.w` is its inverse. A
     * vertex id starts at the draw's first vertex, as SV_VertexID does: the AL
     * applies a base vertex to its attribute pointers, not its ids.
     *
     * @param {number} registerNumber The system semantic.
     * @param {Type} type The HLSL type it is read as.
     * @returns {string} The expression.
     */
    _systemInput(registerNumber, type)
    {
        const scalar = CjsFxGlslTypes.glslScalar(type.builtInType);
        switch (registerNumber)
        {
            case E.position:
            case E.position_invariant:
                return "vec4(gl_FragCoord.xyz, 1.0 / gl_FragCoord.w)";
            case E.front_facing:
                return "gl_FrontFacing";
            case E.vertex_id:
                return `${scalar}(gl_VertexID)`;
            case E.instance_id:
                return `${scalar}(gl_InstanceID)`;
            default:
                throw new Error(`CjsFxOutputGLSL: system semantic ${MetalSystemSemanticsType.getString(registerNumber)} has no GLSL input`);
        }
    }

    // ---------------------------------------------------------------------
    // Functions
    // ---------------------------------------------------------------------

    /**
     * A user function, unless unused.
     *
     * @param {import("../ASTNode/ASTNode.js").ASTNode} node The `NT_FUNCTION_DEFINITION`.
     * @returns {string} The function, or "".
     */
    _writeFunction(node)
    {
        const header = node.GetChild(0);
        const symbol = header.GetSymbol();
        if (!symbol.used)
        {
            return "";
        }
        const params = [];
        for (const param of header.GetChildren())
        {
            const p = param.GetSymbol();
            if (this._isModuleScope(p))
            {
                continue;
            }
            const type = CjsFxGlslTypes.glslType(p.type, s => this._nameOf(s));
            const qualifier = isReferenceParam(param) ? (param.GetToken().type === T.OP_OUT ? "out " : "inout ") : "";
            params.push(`${qualifier}${type} ${this._nameOf(p)}`);
        }
        const returnType = header.GetType();
        this._returnType = returnType;
        return `${CjsFxGlslTypes.glslType(returnType, s => this._nameOf(s))} ${this._nameOf(symbol)}(${params.join(", ")})\n${this._block(node.GetChild(1), 1)}`;
    }

    /**
     * PatchShader's wrapper, as `cjs_entry`. A base vertex or instance is zero:
     * Carbon's subtraction (EffectCompilerMetal.cpp PatchShader) has nothing to
     * subtract, see `_systemInput`.
     *
     * @param {import("../ASTNode/ASTNode.js").ASTNode} node The wrapper's `NT_FUNCTION_DEFINITION`.
     * @returns {string} The function.
     */
    _writeEntry(node)
    {
        const header = node.GetChild(0);
        const params = [];
        const zeros = [];
        for (const param of header.GetChildren())
        {
            const p = param.GetSymbol();
            const reg = registerOf(p);
            if (reg !== null && reg.registerType !== "i" && reg.registerType !== "v")
            {
                continue;
            }
            const type = CjsFxGlslTypes.glslType(p.type, s => this._nameOf(s));
            if (reg !== null && reg.registerType === "v" && (reg.registerNumber === E.base_vertex || reg.registerNumber === E.base_instance))
            {
                zeros.push(`    ${type} ${this._nameOf(p)} = ${type}(0);`);
                continue;
            }
            params.push(`${type} ${this._nameOf(p)}`);
        }
        const returnType = header.GetType();
        this._returnType = returnType;
        const body = this._block(node.GetChild(1), 1);
        const withZeros = zeros.length === 0 ? body : body.replace(/^\{\n/u, `{\n${zeros.join("\n")}\n`);
        return `${CjsFxGlslTypes.glslType(returnType, s => this._nameOf(s))} cjs_entry(${params.join(", ")})\n${withZeros}`;
    }

    /**
     * Whether a parameter stands for a uniform or for nothing: a constant
     * buffer, a texture of the stage's, or a sampler, which GLSL has no value
     * for.
     *
     * @param {object} symbol The parameter's symbol.
     * @returns {boolean} True when it is left out.
     */
    _isModuleScope(symbol)
    {
        if (this._moduleScopeParams.has(symbol) || symbol.type.IsSampler())
        {
            return true;
        }
        if (symbol.addressSpace === Symbol.AddressSpace.Constant || symbol.addressSpace === Symbol.AddressSpace.Device || symbol.addressSpace === Symbol.AddressSpace.Threadgroup)
        {
            return true;
        }
        // AddUsedGlobalsAsFunctionParams threads a resource under its global's name.
        if ((symbol.type.IsTexture() && this._textures.has(this._nameOf(symbol))) || this._structured.has(this._nameOf(symbol)))
        {
            return true;
        }
        return symbol.type.IsStruct() && this._cbuffers.has(symbol.type.symbol);
    }

    // ---------------------------------------------------------------------
    // Statements
    // ---------------------------------------------------------------------

    /**
     * A block's statements, indented.
     *
     * @param {import("../ASTNode/ASTNode.js").ASTNode} node An `NT_BLOCK` or a single statement.
     * @param {number} depth Indent depth of the statements.
     * @returns {string} The block, braces included.
     */
    _block(node, depth)
    {
        const pad = "    ".repeat(depth - 1);
        const statements = node && node.GetNodeType() === N.NT_BLOCK ? node.GetChildren() : [node];
        const lines = [];
        for (const statement of statements)
        {
            if (statement !== null)
            {
                lines.push(this._statement(statement, depth));
            }
        }
        return `${pad}{\n${lines.filter(line => line !== "").join("\n")}\n${pad}}`;
    }

    /**
     * One statement.
     *
     * @param {import("../ASTNode/ASTNode.js").ASTNode} node The statement.
     * @param {number} depth Indent depth.
     * @returns {string} Its lines.
     */
    _statement(node, depth)
    {
        const pad = "    ".repeat(depth);
        switch (node.GetNodeType())
        {
            case N.NT_BLOCK:
                return this._block(node, depth + 1);
            case N.NT_VAR_DECLARATION_LIST:
                return node.GetChildren().filter(Boolean).map(n => pad + this._localDeclaration(n)).join("\n");
            case N.NT_EXPRESSION_STATEMENT:
                if (node.GetChildrenCount() === 0 || node.GetChild(0) === null)
                {
                    return "";
                }
                return this._expressionStatement(node.GetChild(0), pad);
            case N.NT_IF:
            {
                let text = `${pad}if (${this._condition(node.GetChild(0))})\n${this._block(node.GetChild(1), depth + 1)}`;
                if (node.GetChildrenCount() > 2 && node.GetChild(2) !== null)
                {
                    text += `\n${pad}else\n${this._block(node.GetChild(2), depth + 1)}`;
                }
                return text;
            }
            case N.NT_WHILE:
                return `${pad}while (${this._condition(node.GetChild(0))})\n${this._block(node.GetChild(1), depth + 1)}`;
            case N.NT_DO:
                return `${pad}do\n${this._block(node.GetChild(1), depth + 1)}\n${pad}while (${this._condition(node.GetChild(0))});`;
            case N.NT_FOR:
            {
                const init = node.GetChild(0);
                const initText = init === null ? "" : init.GetNodeType() === N.NT_VAR_DECLARATION_LIST
                    ? init.GetChildren().filter(Boolean).map(n => this._localDeclaration(n).replace(/;$/u, "")).join(", ")
                    : this._expressionStatement(init.GetNodeType() === N.NT_EXPRESSION_STATEMENT ? init.GetChild(0) : init, "").replace(/;$/u, "");
                const test = node.GetChild(1);
                const condition = test === null ? "" : this._condition(test.GetNodeType() === N.NT_EXPRESSION_STATEMENT ? test.GetChild(0) : test);
                const update = node.GetChild(2) === null ? "" : this._expressionStatement(node.GetChild(2), "").replace(/;$/u, "");
                return `${pad}for (${initText}; ${condition}; ${update})\n${this._block(node.GetChild(3), depth + 1)}`;
            }
            case N.NT_JUMP:
                switch (node.GetToken().type)
                {
                    case T.OP_CONTINUE:
                        return `${pad}continue;`;
                    case T.OP_BREAK:
                        return `${pad}break;`;
                    case T.OP_DISCARD:
                        return `${pad}discard;`;
                    default:
                        if (node.GetChildrenCount() === 0)
                        {
                            return `${pad}return;`;
                        }
                        return `${pad}return ${this._coerced(node.GetChild(0), this._returnType)};`;
                }
            default:
                throw new Error(`CjsFxOutputGLSL: statement ${nodeName(node)} is not supported yet`);
        }
    }

    /**
     * A local declaration: `T name = init;`.
     *
     * @param {import("../ASTNode/ASTNode.js").ASTNode} node The `NT_NAME_DECLARATION`.
     * @returns {string} The declaration.
     */
    _localDeclaration(node)
    {
        const symbol = node.GetSymbol();
        const type = CjsFxGlslTypes.glslType(symbol.type, s => this._nameOf(s));
        const init = node.GetChildOrNull(1);
        return `${type} ${this._nameOf(symbol)}${init ? ` = ${this._initializer(init, symbol.type)}` : ""};`;
    }

    /**
     * An initializer converted to its declaration's type; an inline
     * constructor `{ ... }` becomes the type's constructor.
     *
     * @param {import("../ASTNode/ASTNode.js").ASTNode} node The initializer.
     * @param {Type} type The declared type.
     * @returns {string} The expression.
     */
    _initializer(node, type)
    {
        if (node.GetNodeType() === N.NT_INLINE_CONSTRUCTOR)
        {
            const target = CjsFxGlslTypes.glslType(type, s => this._nameOf(s));
            const element = type.Copy();
            if (type.arrayDimensions > 0)
            {
                element.arrayDimensions = 0;
                return `${target}(${node.GetChildren().map(child => this._initializer(child, element)).join(", ")})`;
            }
            const component = type.Copy();
            component.width = 1;
            component.height = 1;
            return `${target}(${node.GetChildren().map(child => this._coerced(child, component)).join(", ")})`;
        }
        return this._coerced(node, type);
    }

    /**
     * An expression in statement position: an assignment, an increment or a
     * call.
     *
     * @param {import("../ASTNode/ASTNode.js").ASTNode} node The expression.
     * @param {string} pad Indent.
     * @returns {string} The statement.
     */
    _expressionStatement(node, pad)
    {
        if (node.GetNodeType() === N.NT_EXPRESSION && node.GetToken() && ASSIGNMENT.has(node.GetToken().type))
        {
            return this._assignment(node, pad);
        }
        if (node.GetNodeType() === N.NT_EXPRESSION && node.GetToken() && node.GetToken().type === T.OP_LEFT_PAREN)
        {
            return this._expressionStatement(node.GetChild(0), pad);
        }
        if (node.GetNodeType() === N.NT_POSTFIX_EXPRESSION && node.GetToken().type === T.OP_DOT &&
            node.GetChild(1).GetToken().stringValue.ToString() === "GetDimensions")
        {
            return this._getDimensions(node.GetChild(0), node.GetChild(1).GetChildren(), pad);
        }
        if ((node.GetNodeType() === N.NT_POSTFIX_EXPRESSION || node.GetNodeType() === N.NT_PREFIX_EXPRESSION) &&
            (node.GetToken().type === T.OP_INC_OP || node.GetToken().type === T.OP_DEC_OP))
        {
            return `${pad}${this._lvalue(node.GetChild(0))}${node.GetToken().type === T.OP_INC_OP ? "++" : "--"};`;
        }
        if (node.GetNodeType() === N.NT_FUNCTION_CALL)
        {
            return `${pad}${this._expression(node)};`;
        }
        throw new Error(`CjsFxOutputGLSL: expression statement ${nodeName(node)} is not supported yet`);
    }

    /**
     * HLSL's `texture.GetDimensions(out width, out height)` on a 2D texture:
     * each out argument is assigned its component of `textureSize`, converted
     * to the argument's type as HLSL does.
     *
     * @param {import("../ASTNode/ASTNode.js").ASTNode} object The texture.
     * @param {import("../ASTNode/ASTNode.js").ASTNode[]} args The out arguments.
     * @param {string} pad Indent.
     * @returns {string} The statements.
     */
    _getDimensions(object, args, pad)
    {
        const objectType = typeOf(object);
        if (!objectType.IsTexture() || args.length !== 2 || objectType.IsTextureArray())
        {
            throw new Error("CjsFxOutputGLSL: GetDimensions with these arguments is not supported yet");
        }
        const temp = `cjs_t${this._temps++}`;
        const int = new Type();
        int.FromTokenType(T.OP_INT);
        const lines = [`${pad}{`, `${pad}    ivec2 ${temp} = textureSize(${this._expression(object)}, 0);`];
        args.forEach((arg, i) =>
        {
            lines.push(`${pad}    ${this._lvalue(arg)} = ${this._convert(`${temp}.${"xy"[i]}`, int, typeOf(arg))};`);
        });
        lines.push(`${pad}}`);
        return lines.join("\n");
    }

    /**
     * An assignment statement, with HLSL's implicit conversion of the value.
     *
     * @param {import("../ASTNode/ASTNode.js").ASTNode} node The `NT_EXPRESSION` assignment.
     * @param {string} pad Indent.
     * @returns {string} The statement.
     */
    _assignment(node, pad)
    {
        const target = node.GetChild(0);
        const targetType = typeOf(target);
        const operator = ASSIGNMENT.get(node.GetToken().type);
        const left = this._lvalue(target);
        if (operator === "")
        {
            return `${pad}${left} = ${this._coerced(node.GetChild(1), targetType)};`;
        }
        if (operator === "*" && targetType.IsMatrix() && typeOf(node.GetChild(1)).IsMatrix())
        {
            return `${pad}${left} = matrixCompMult(${left}, ${this._coerced(node.GetChild(1), targetType)});`;
        }
        return `${pad}${left} ${operator}= ${this._operand(node.GetChild(1), targetType, operator)};`;
    }

    /**
     * The right operand of a compound assignment, converted so `left op right`
     * is valid GLSL: a scalar stays scalar beside a vector target.
     *
     * @param {import("../ASTNode/ASTNode.js").ASTNode} node The operand.
     * @param {Type} targetType The target's type.
     * @param {string} operator The binary operator.
     * @returns {string} The expression.
     */
    _operand(node, targetType, operator)
    {
        const type = typeOf(node);
        if (operator === "<<" || operator === ">>")
        {
            return this._coerced(node, withComponent(targetType.width > 1 ? shapeOf(targetType) : scalarOf(targetType), T.OP_UINT));
        }
        if (type.IsScalar() && !targetType.IsScalar())
        {
            return this._coerced(node, scalarOf(targetType));
        }
        return this._coerced(node, targetType);
    }

    /**
     * A condition as GLSL `bool`.
     *
     * @param {import("../ASTNode/ASTNode.js").ASTNode} node The condition.
     * @returns {string} The expression.
     */
    _condition(node)
    {
        const bool = new Type();
        bool.FromTokenType(T.OP_BOOL);
        return this._coerced(node, bool);
    }

    // ---------------------------------------------------------------------
    // Expressions
    // ---------------------------------------------------------------------

    /**
     * An expression converted to `type` the way HLSL converts implicitly.
     *
     * @param {import("../ASTNode/ASTNode.js").ASTNode} node The expression.
     * @param {Type} type The type wanted.
     * @returns {string} The expression.
     */
    _coerced(node, type)
    {
        return this._convert(this._expression(node), typeOf(node), type);
    }

    /**
     * Converts an expression of one HLSL type to another as HLSL does
     * implicitly: component conversion, scalar splat, vector truncation
     * and conversions to and from bool.
     *
     * @param {string} text The expression.
     * @param {Type} from Its type.
     * @param {Type} to The type wanted.
     * @returns {string} The converted expression.
     */
    _convert(text, from, to)
    {
        if (to.IsStruct() || from.IsStruct() || to.arrayDimensions > 0 || from.arrayDimensions > 0)
        {
            return text;
        }
        if (to.IsMatrix() || from.IsMatrix())
        {
            if (to.IsMatrix() && from.IsMatrix())
            {
                // GLSL's matrix constructor keeps the upper-left of a larger one.
                return to.width === from.width && to.height === from.height ? text : `mat${to.height}x${to.width}(${text})`;
            }
            if (to.IsMatrix())
            {
                throw new Error(`CjsFxOutputGLSL: a conversion from ${from.ToString()} to ${to.ToString()} is not supported yet`);
            }
            return text;
        }
        if (!to.IsScalarOrVector() || !from.IsScalarOrVector())
        {
            return text;
        }
        const fromScalar = CjsFxGlslTypes.glslScalar(from.builtInType);
        const toScalar = CjsFxGlslTypes.glslScalar(to.builtInType);
        if (fromScalar === null || toScalar === null)
        {
            return text;
        }
        let result = text;
        let width = from.width;
        if (to.width < width)
        {
            result = `(${result}).${"xyzw".slice(0, to.width)}`;
            width = to.width;
        }
        if (fromScalar !== toScalar)
        {
            result = `${CjsFxGlslTypes.glslVector(toScalar, width)}(${result})`;
        }
        if (to.width > width)
        {
            if (width !== 1)
            {
                throw new Error(`CjsFxOutputGLSL: cannot widen a ${from.ToString()} to a ${to.ToString()}`);
            }
            result = `${CjsFxGlslTypes.glslVector(toScalar, to.width)}(${result})`;
        }
        return result;
    }

    /**
     * An assignable expression.
     *
     * @param {import("../ASTNode/ASTNode.js").ASTNode} node The target.
     * @returns {string} The expression.
     */
    _lvalue(node)
    {
        return this._expression(node);
    }

    /**
     * An expression of its own HLSL type.
     *
     * @param {import("../ASTNode/ASTNode.js").ASTNode} node The expression.
     * @returns {string} The expression.
     */
    _expression(node)
    {
        switch (node.GetNodeType())
        {
            case N.NT_VAR_IDENTIFIER:
                return this._nameOf(node.GetSymbol());
            case N.NT_CONSTANT:
                return literal(node);
            case N.NT_EXPRESSION:
                return this._binary(node);
            case N.NT_PREFIX_EXPRESSION:
                return this._prefix(node);
            case N.NT_POSTFIX_EXPRESSION:
                return this._postfix(node);
            case N.NT_CONDITIONAL_EXPRESSION:
                return this._conditional(node);
            case N.NT_CAST_EXPRESSION:
                return `(${this._coerced(node.GetChild(0), node.GetType())})`;
            case N.NT_FUNCTION_CALL:
                return this._call(node);
            default:
                throw new Error(`CjsFxOutputGLSL: expression ${nodeName(node)} is not supported yet`);
        }
    }

    /**
     * `c ? a : b`. A vector condition picks per component, which GLSL's `?:`
     * does not; `mix` does, for float results.
     *
     * @param {import("../ASTNode/ASTNode.js").ASTNode} node The `NT_CONDITIONAL_EXPRESSION`.
     * @returns {string} The expression.
     */
    _conditional(node)
    {
        const type = typeOf(node);
        const conditionType = typeOf(node.GetChild(0));
        const whenTrue = this._coerced(node.GetChild(1), type);
        const whenFalse = this._coerced(node.GetChild(2), type);
        if (conditionType.width === 1 || type.width === 1)
        {
            const bool = new Type();
            bool.FromTokenType(T.OP_BOOL);
            return `(${this._coerced(node.GetChild(0), bool)} ? ${whenTrue} : ${whenFalse})`;
        }
        if (CjsFxGlslTypes.glslScalar(type.builtInType) !== "float")
        {
            throw new Error("CjsFxOutputGLSL: a per-component choice between integers is not supported yet");
        }
        return `mix(${whenFalse}, ${whenTrue}, ${this._coerced(node.GetChild(0), withComponent(shapeOf(type), T.OP_BOOL))})`;
    }

    /**
     * A binary expression, operands converted to their common type; a scalar
     * beside a vector stays scalar, which GLSL's arithmetic allows.
     *
     * @param {import("../ASTNode/ASTNode.js").ASTNode} node The `NT_EXPRESSION`.
     * @returns {string} The expression.
     */
    _binary(node)
    {
        const token = node.GetToken().type;
        if (token === T.OP_LEFT_PAREN || token === 0)
        {
            return `(${this._expression(node.GetChild(0))})`;
        }
        if (ASSIGNMENT.has(token))
        {
            throw new Error("CjsFxOutputGLSL: an assignment inside an expression is not supported yet");
        }
        if (token === T.OP_COMA)
        {
            throw new Error("CjsFxOutputGLSL: the comma operator is not supported yet");
        }
        const operator = BINARY.get(token);
        if (operator === undefined)
        {
            throw new Error(`CjsFxOutputGLSL: operator ${node.GetToken().stringValue.ToString()} is not supported yet`);
        }
        const left = node.GetChild(0);
        const right = node.GetChild(1);
        const leftType = typeOf(left);
        const rightType = typeOf(right);
        const common = new Type();
        if (!Type.getCommonType(leftType, rightType, common))
        {
            common.Assign(leftType);
        }
        if (token === T.OP_AND_OP || token === T.OP_OR_OP)
        {
            const bool = withComponent(common.width > 1 ? shapeOf(common) : scalarOf(common), T.OP_BOOL);
            if (common.width > 1)
            {
                return this._booleanVector(token, this._coerced(left, bool), this._coerced(right, bool), common.width);
            }
            return `(${this._coerced(left, bool)} ${operator} ${this._coerced(right, bool)})`;
        }
        if (COMPARISONS.has(token) && common.width > 1)
        {
            return `${VECTOR_COMPARISONS.get(token)}(${this._coerced(left, common)}, ${this._coerced(right, common)})`;
        }
        if (token === T.OP_LEFT_OP || token === T.OP_RIGHT_OP)
        {
            const amount = withComponent(rightType.width > 1 ? shapeOf(common) : scalarOf(common), T.OP_UINT);
            return `(${this._coerced(left, common)} ${operator} ${this._coerced(right, amount)})`;
        }
        if (token === T.OP_STAR && leftType.IsMatrix() && rightType.IsMatrix())
        {
            return `matrixCompMult(${this._coerced(left, common)}, ${this._coerced(right, common)})`;
        }
        const leftScalar = leftType.IsScalar() && !COMPARISONS.has(token) && (rightType.IsVector() || rightType.IsMatrix());
        const rightScalar = rightType.IsScalar() && !COMPARISONS.has(token) && (leftType.IsVector() || leftType.IsMatrix());
        const leftText = leftScalar ? this._coerced(left, scalarOf(common)) : this._coerced(left, common);
        const rightText = rightScalar ? this._coerced(right, scalarOf(common)) : this._coerced(right, common);
        if (token === T.OP_PERCENT && CjsFxGlslTypes.glslScalar(common.builtInType) === "float")
        {
            return this._fmod(leftText, rightText, common);
        }
        return `(${leftText} ${operator} ${rightText})`;
    }

    /**
     * `&&` or `||` per component, as a generated helper: GLSL's operators take
     * only scalar bools.
     *
     * @param {number} token The operator's token.
     * @param {string} left The left operand, a bool vector.
     * @param {string} right The right operand.
     * @param {number} width The component count.
     * @returns {string} The call.
     */
    _booleanVector(token, left, right, width)
    {
        const operator = BINARY.get(token);
        const name = `cjs_${token === T.OP_AND_OP ? "and" : "or"}${width}`;
        if (!this._helpers.has(name))
        {
            const type = CjsFxGlslTypes.glslVector("bool", width);
            const parts = "xyzw".slice(0, width).split("").map(c => `a.${c} ${operator} b.${c}`);
            this._helpers.set(name, `${type} ${name}(${type} a, ${type} b)\n{\n    return ${type}(${parts.join(", ")});\n}`);
        }
        return `${name}(${left}, ${right})`;
    }

    /**
     * HLSL's `fmod`, whose result takes the sign of `a`, where GLSL's `mod`
     * takes that of `b`, as a generated helper.
     *
     * @param {string} a The dividend.
     * @param {string} b The divisor.
     * @param {Type} type Their type.
     * @returns {string} The call.
     */
    _fmod(a, b, type)
    {
        const glsl = CjsFxGlslTypes.glslType(type, s => this._nameOf(s));
        const name = `cjs_fmod_${glsl}`;
        if (!this._helpers.has(name))
        {
            this._helpers.set(name, `${glsl} ${name}(${glsl} a, ${glsl} b)\n{\n    return a - b * trunc(a / b);\n}`);
        }
        return `${name}(${a}, ${b})`;
    }

    /**
     * A prefix expression.
     *
     * @param {import("../ASTNode/ASTNode.js").ASTNode} node The `NT_PREFIX_EXPRESSION`.
     * @returns {string} The expression.
     */
    _prefix(node)
    {
        const operand = node.GetChild(0);
        const type = typeOf(node);
        switch (node.GetToken().type)
        {
            case T.OP_DASH:
                return `(-${this._coerced(operand, type)})`;
            case T.OP_PLUS:
                return this._coerced(operand, type);
            case T.OP_BANG:
            {
                const text = this._coerced(operand, withComponent(type.width > 1 ? shapeOf(type) : scalarOf(type), T.OP_BOOL));
                return type.width > 1 ? `not(${text})` : `(!${text})`;
            }
            case T.OP_TILDE:
                return `(~${this._coerced(operand, type)})`;
            default:
                throw new Error("CjsFxOutputGLSL: increment or decrement inside an expression is not supported yet");
        }
    }

    /**
     * A swizzle of a value.
     *
     * @param {string} text The value.
     * @param {Type} type Its type.
     * @param {string} field The HLSL swizzle.
     * @returns {string} The expression.
     */
    _swizzle(text, type, field)
    {
        const swizzle = field.split("").map(normaliseComponent).join("");
        if (type.width === 1)
        {
            return swizzle.length === 1 ? text : `${CjsFxGlslTypes.glslVector(CjsFxGlslTypes.glslScalar(type.builtInType), swizzle.length)}(${text})`;
        }
        return `${text}.${swizzle}`;
    }

    /**
     * A postfix expression: member, swizzle, index or method call. A member
     * of a constant buffer is read from its registers.
     *
     * @param {import("../ASTNode/ASTNode.js").ASTNode} node The `NT_POSTFIX_EXPRESSION`.
     * @returns {string} The expression.
     */
    _postfix(node)
    {
        const object = node.GetChild(0);
        const token = node.GetToken().type;
        const cbuffer = this._cbufferAccess(node);
        if (cbuffer !== null)
        {
            return cbuffer;
        }
        switch (token)
        {
            case T.OP_ID:
            {
                const objectType = typeOf(object);
                const field = node.GetToken().stringValue.ToString();
                if (objectType.IsMatrix())
                {
                    throw new Error(`CjsFxOutputGLSL: matrix member ${field} is not supported yet`);
                }
                if (objectType.IsScalarOrVector())
                {
                    return this._swizzle(this._expression(object), objectType, field);
                }
                return `${this._expression(object)}.${this._nameOf(node.GetSymbol())}`;
            }
            case T.OP_LEFT_BRACKET:
            {
                const index = node.GetChild(1);
                const indexType = typeOf(index);
                const integer = indexType.builtInType === T.OP_INT || indexType.builtInType === T.OP_UINT ? indexType : withComponent(indexType, T.OP_INT);
                if (typeOf(object).builtInType === T.OP_STRUCTUREDBUFFER)
                {
                    return this._readStructured(object, this._coerced(index, withComponent(scalarOf(indexType), T.OP_INT)));
                }
                return `${this._expression(object)}[${this._coerced(index, integer)}]`;
            }
            case T.OP_DOT:
                return this._method(object, node.GetChild(1), node);
            case T.OP_INC_OP:
            case T.OP_DEC_OP:
                throw new Error("CjsFxOutputGLSL: increment or decrement inside an expression is not supported yet");
            default:
                throw new Error(`CjsFxOutputGLSL: postfix ${node.GetToken().stringValue.ToString()} is not supported yet`);
        }
    }

    /**
     * A read of a constant-buffer member, `PerObjectVS.worldTransform` or
     * CollectGlobals' `Globals.x`, as its packed registers, or null when
     * `node` is not one.
     *
     * @param {import("../ASTNode/ASTNode.js").ASTNode} node A postfix expression.
     * @returns {string|null} The expression.
     */
    _cbufferAccess(node)
    {
        const path = [];
        let current = node;
        while (current.GetNodeType() === N.NT_POSTFIX_EXPRESSION && (current.GetToken().type === T.OP_ID || current.GetToken().type === T.OP_DOT || current.GetToken().type === T.OP_LEFT_BRACKET))
        {
            path.unshift(current);
            current = current.GetChild(0);
        }
        if (current.GetNodeType() !== N.NT_VAR_IDENTIFIER)
        {
            return null;
        }
        const root = current.GetSymbol();
        const rootType = root.type;
        if (!rootType.IsStruct() || !this._cbuffers.has(rootType.symbol))
        {
            return null;
        }
        const cbuffer = this._cbuffers.get(rootType.symbol);
        let layout = cbuffer.layout;
        let offset = 0;
        let type = null;
        let dynamicIndex = null;
        let consumed = 0;
        for (const step of path)
        {
            const token = step.GetToken().type;
            if (token === T.OP_LEFT_BRACKET)
            {
                if (type === null || type.arrayDimensions === 0)
                {
                    break;
                }
                const element = type.Copy();
                element.arrayDimensions = 0;
                const stride = CjsFxHlslPacking.place(element, 0).stride;
                const index = step.GetChild(1);
                const indexText = this._coerced(index, withComponent(scalarOf(typeOf(index)), T.OP_INT));
                const scaled = `(${indexText}) * ${stride / CjsFxHlslPacking.registerBytes}`;
                dynamicIndex = dynamicIndex === null ? scaled : `${dynamicIndex} + ${scaled}`;
                type = element;
                consumed++;
                continue;
            }
            const memberSymbol = token === T.OP_DOT ? step.GetChild(1).GetSymbol() : step.GetSymbol();
            if (layout === null || !memberSymbol || !layout.members.has(memberSymbol))
            {
                break;
            }
            const member = layout.members.get(memberSymbol);
            offset += member.offset;
            type = member.type;
            layout = type.IsStruct() && type.arrayDimensions === 0 ? CjsFxHlslPacking.structLayout(type.symbol) : null;
            consumed++;
        }
        if (type === null)
        {
            throw new Error(`CjsFxOutputGLSL: constant buffer ${root.name.ToString()} is used whole, which registers cannot express`);
        }
        if (type.IsStruct() || type.arrayDimensions > 0)
        {
            throw new Error(`CjsFxOutputGLSL: a whole struct or array is read from constant buffer ${root.name.ToString()}, which is not supported yet`);
        }
        let text = this._readRegisters(cbuffer.name, offset, type, dynamicIndex);
        // Anything after the member (a swizzle or an index into a vector) applies to the value.
        for (let i = consumed; i < path.length; ++i)
        {
            const step = path[i];
            if (step.GetToken().type === T.OP_ID && type.IsScalarOrVector())
            {
                text = this._swizzle(text, type, step.GetToken().stringValue.ToString());
                type = typeOf(step);
                continue;
            }
            if (step.GetToken().type === T.OP_LEFT_BRACKET)
            {
                const index = step.GetChild(1);
                text = `${text}[${this._coerced(index, withComponent(scalarOf(typeOf(index)), T.OP_INT))}]`;
                type = typeOf(step);
                continue;
            }
            throw new Error(`CjsFxOutputGLSL: unsupported access after constant-buffer member in ${root.name.ToString()}`);
        }
        return text;
    }

    /**
     * Reads a value of `type` at a byte offset of a constant buffer declared
     * `uniform vec4 name[N]`: vectors from register lanes, matrices from
     * consecutive registers, integers by bit cast.
     *
     * @param {string} name The buffer variable.
     * @param {number} offset The value's byte offset.
     * @param {Type} type Its type, not an array.
     * @param {string|null} dynamicIndex A register offset computed at run time, or null.
     * @returns {string} The expression.
     */
    _readRegisters(name, offset, type, dynamicIndex)
    {
        const register = Math.floor(offset / CjsFxHlslPacking.registerBytes);
        const lane = (offset % CjsFxHlslPacking.registerBytes) / 4;
        const at = r => (dynamicIndex === null ? `${name}[${register + r}]` : `${name}[${register + r} + ${dynamicIndex}]`);
        if (type.IsMatrix())
        {
            const rowMajor = CjsFxHlslPacking.isRowMajor(type);
            const columns = rowMajor ? type.width : type.height;
            const lanes = rowMajor ? type.height : type.width;
            const vectors = [];
            for (let c = 0; c < columns; ++c)
            {
                vectors.push(lanes === 4 ? at(c) : `${at(c)}.${"xyzw".slice(0, lanes)}`);
            }
            const stored = `mat${columns}x${lanes}(${vectors.join(", ")})`;
            return rowMajor ? `transpose(${stored})` : stored;
        }
        const vector = type.width === 4 ? at(0) : `${at(0)}.${"xyzw".slice(lane, lane + type.width)}`;
        switch (CjsFxGlslTypes.glslScalar(type.builtInType))
        {
            case "float":
                return vector;
            case "int":
                return `floatBitsToInt(${vector})`;
            case "uint":
                return `floatBitsToUint(${vector})`;
            default:
                return type.width === 1
                    ? `(floatBitsToUint(${vector}) != 0u)`
                    : `notEqual(floatBitsToUint(${vector}), ${CjsFxGlslTypes.glslVector("uint", type.width)}(0u))`;
        }
    }

    /**
     * An element of a structured buffer, through a generated helper that
     * builds it from the block's registers.
     *
     * @param {import("../ASTNode/ASTNode.js").ASTNode} object The buffer.
     * @param {string} index The element, an int.
     * @returns {string} The call.
     */
    _readStructured(object, index)
    {
        const objectType = typeOf(object);
        const { block, rows, texture } = this._structured.get(this._nameOf(object.GetSymbol()));
        const type = objectType.templateParameter;
        const name = `cjs_read_${block}`;
        if (!this._structReaders.has(type.symbol))
        {
            const glsl = CjsFxGlslTypes.glslType(type, s => this._nameOf(s));
            const read = row =>
            {
                const at = `index * ${rows} + ${row}`;
                return texture ? `uintBitsToFloat(texelFetch(${block}, ivec2((${at}) & ${DATA_TEXTURE_WIDTH - 1}, (${at}) >> ${Math.log2(DATA_TEXTURE_WIDTH)}), 0))` : `${block}.data[${at}]`;
            };
            const lines = membersOf(type).map((member, row) => `    value.${this._nameOf(member)} = ${read(row)};`);
            this._structReaders.set(type.symbol, `${glsl} ${name}(int index)\n{\n    ${glsl} value;\n${lines.join("\n")}\n    return value;\n}`);
        }
        return `${name}(${index})`;
    }

    /**
     * A method call on an object: texture sampling and loads.
     *
     * @param {import("../ASTNode/ASTNode.js").ASTNode} object The object.
     * @param {import("../ASTNode/ASTNode.js").ASTNode} call The method's `NT_FUNCTION_CALL`.
     * @param {import("../ASTNode/ASTNode.js").ASTNode} node The postfix expression, typed with the result.
     * @returns {string} The expression.
     */
    _method(object, call, node)
    {
        const method = call.GetToken().stringValue.ToString();
        const objectType = typeOf(object);
        const args = call.GetChildren();
        if (!objectType.IsTexture())
        {
            throw new Error(`CjsFxOutputGLSL: method ${method} on ${objectType.ToString()} is not supported yet`);
        }
        const target = this._expression(object);
        const float = new Type();
        float.FromTokenType(T.OP_FLOAT);
        const coordinate = arg => this._coerced(arg, withComponent(typeOf(arg), T.OP_FLOAT));
        const offsetOf = count =>
        {
            if (args.length === count)
            {
                return null;
            }
            if (args.length !== count + 1)
            {
                throw new Error(`CjsFxOutputGLSL: ${method} with these arguments is not supported yet`);
            }
            return this._coerced(args[count], withComponent(typeOf(args[count]), T.OP_INT));
        };
        let sampled;
        switch (method)
        {
            case "Sample":
            {
                this._pairSampler(target, args[0]);
                const offset = offsetOf(2);
                sampled = offset === null ? `texture(${target}, ${coordinate(args[1])})` : `textureOffset(${target}, ${coordinate(args[1])}, ${offset})`;
                break;
            }
            case "SampleLevel":
            {
                this._pairSampler(target, args[0]);
                const offset = offsetOf(3);
                const level = this._coerced(args[2], float);
                sampled = offset === null ? `textureLod(${target}, ${coordinate(args[1])}, ${level})` : `textureLodOffset(${target}, ${coordinate(args[1])}, ${level}, ${offset})`;
                break;
            }
            case "SampleBias":
            {
                this._pairSampler(target, args[0]);
                const offset = offsetOf(3);
                const bias = this._coerced(args[2], float);
                sampled = offset === null ? `texture(${target}, ${coordinate(args[1])}, ${bias})` : `textureOffset(${target}, ${coordinate(args[1])}, ${offset}, ${bias})`;
                break;
            }
            case "SampleGrad":
            {
                this._pairSampler(target, args[0]);
                const offset = offsetOf(4);
                const gradients = `${coordinate(args[1])}, ${coordinate(args[2])}, ${coordinate(args[3])}`;
                sampled = offset === null ? `textureGrad(${target}, ${gradients})` : `textureGradOffset(${target}, ${gradients}, ${offset})`;
                break;
            }
            case "Load":
            {
                // HLSL's Load(int3(x, y, mip)) on a 2D texture.
                if (args.length !== 1 || objectType.IsTextureArray() || objectType.builtInType === T.OP_TEXTURECUBE)
                {
                    throw new Error(`CjsFxOutputGLSL: ${method} with these arguments is not supported yet`);
                }
                const location = this._coerced(args[0], withComponent(typeOf(args[0]), T.OP_INT));
                sampled = `texelFetch(${target}, (${location}).xy, (${location}).z)`;
                break;
            }
            default:
                throw new Error(`CjsFxOutputGLSL: texture method ${method} is not supported yet`);
        }
        const resultType = typeOf(node);
        return resultType.width === 4 || resultType.width === 0 ? sampled : `${sampled}.${"xyzw".slice(0, resultType.width)}`;
    }

    /**
     * Records the sampler a sample site pairs with a texture. GLSL binds them
     * as one uniform, so the block carries the pairing (glslBackendBlock.js).
     *
     * @param {string} textureName The texture's uniform.
     * @param {import("../ASTNode/ASTNode.js").ASTNode} sampler The sample site's sampler.
     */
    _pairSampler(textureName, sampler)
    {
        const binding = this._textures.get(textureName);
        const register = sampler.GetNodeType() === N.NT_VAR_IDENTIFIER ? this._samplers.get(this._nameOf(sampler.GetSymbol())) : undefined;
        if (binding === undefined || register === undefined)
        {
            throw new Error(`CjsFxOutputGLSL: ${textureName} is sampled through a parameter, which is not supported yet`);
        }
        if (!binding.pairedSamplerRegisters.includes(register))
        {
            binding.pairedSamplerRegisters.push(register);
        }
    }

    /**
     * A function call: a type constructor, an intrinsic, or a user function
     * with its arguments converted to the parameter types.
     *
     * @param {import("../ASTNode/ASTNode.js").ASTNode} node The `NT_FUNCTION_CALL`.
     * @returns {string} The expression.
     */
    _call(node)
    {
        const symbol = node.GetSymbol();
        const args = node.GetChildren();
        if (symbol === null)
        {
            // A type constructor: float4(a, b), float3x3(...).
            const type = typeOf(node);
            if (type.IsScalar())
            {
                return this._coerced(args[0], scalarOf(type));
            }
            const converted = args.map(arg =>
            {
                const argType = typeOf(arg);
                return this._coerced(arg, argType.IsScalarOrVector() ? withComponent(argType, type.builtInType) : argType);
            });
            return `${CjsFxGlslTypes.glslType(type, s => this._nameOf(s))}(${converted.join(", ")})`;
        }
        if (symbol.definition === null || symbol.intrinsicType)
        {
            return this._intrinsic(symbol.name.ToString(), node, args);
        }
        const header = symbol.definition.GetNodeType() === N.NT_FUNCTION_DEFINITION ? symbol.definition.GetChild(0) : symbol.definition;
        const parts = [];
        for (let i = 0; i < args.length; ++i)
        {
            const param = header.GetChildOrNull(i);
            if (param && this._isModuleScope(param.GetSymbol()))
            {
                continue;
            }
            if (param && isReferenceParam(param))
            {
                parts.push(this._lvalue(args[i]));
                continue;
            }
            parts.push(param ? this._coerced(args[i], param.GetSymbol().type) : this._expression(args[i]));
        }
        return `${this._nameOf(symbol)}(${parts.join(", ")})`;
    }

    /**
     * An HLSL intrinsic call.
     *
     * @param {string} name The intrinsic.
     * @param {import("../ASTNode/ASTNode.js").ASTNode} node The call, typed with the result.
     * @param {import("../ASTNode/ASTNode.js").ASTNode[]} args The arguments.
     * @returns {string} The expression.
     */
    _intrinsic(name, node, args)
    {
        const type = typeOf(node);
        const sameAs = arg => this._coerced(arg, type);
        switch (name)
        {
            case "mul":
            {
                const left = typeOf(args[0]);
                const right = typeOf(args[1]);
                // HLSL's vector/vector overload is a dot product. Other shapes
                // retain GLSL multiplication with HLSL conversions.
                const component = type.builtInType;
                const a = this._coerced(args[0], withComponent(left, component));
                const rightShape = left.IsVector() && right.IsVector() ? left : right;
                const b = this._coerced(args[1], withComponent(rightShape, component));
                return left.IsVector() && right.IsVector() ? `dot(${a}, ${b})` : `(${a} * ${b})`;
            }
            case "mad":
                return `(${sameAs(args[0])} * ${sameAs(args[1])} + ${sameAs(args[2])})`;
            case "rcp":
                return `(1.0 / ${sameAs(args[0])})`;
            case "fmod":
                return this._fmod(sameAs(args[0]), sameAs(args[1]), type);
            case "log10":
                return `(log(${sameAs(args[0])}) * 0.43429448190325176)`;
            case "saturate":
                return `clamp(${sameAs(args[0])}, 0.0, 1.0)`;
            case "ldexp":
                return `(${sameAs(args[0])} * pow(2.0, ${sameAs(args[1])}))`;
            case "any":
            case "all":
            {
                const argType = typeOf(args[0]);
                const text = this._coerced(args[0], withComponent(argType, T.OP_BOOL));
                return argType.width === 1 ? text : `${name}(${text})`;
            }
            case "asfloat":
            case "asint":
            case "asuint":
                return this._bitCast(name, args[0]);
            case "length":
            case "distance":
            case "dot":
            case "cross":
            case "normalize":
            case "reflect":
            case "refract":
            case "faceforward":
            {
                // Arguments take the argument shape, not the (scalar) result's.
                const shape = withComponent(typeOf(args[0]), T.OP_FLOAT);
                const converted = args.map((arg, i) => this._coerced(arg, name === "refract" && i === 2 ? scalarOf(shape) : shape));
                return `${name}(${converted.join(", ")})`;
            }
            case "transpose":
            case "determinant":
                return `${name}(${this._expression(args[0])})`;
            case "sign":
            {
                // HLSL's sign returns int; GLSL's returns the argument's type.
                return this._convert(`sign(${this._expression(args[0])})`, typeOf(args[0]), type);
            }
            default:
                break;
        }
        const glsl = INTRINSICS.get(name);
        if (glsl === undefined)
        {
            throw new Error(`CjsFxOutputGLSL: intrinsic ${name} is not supported yet`);
        }
        return `${glsl}(${args.map(sameAs).join(", ")})`;
    }

    /**
     * `asfloat`, `asint` or `asuint`. GLSL's bit casts are all to or from
     * float, and its int-to-uint conversion keeps the bits.
     *
     * @param {string} name The intrinsic.
     * @param {import("../ASTNode/ASTNode.js").ASTNode} arg The argument.
     * @returns {string} The expression.
     */
    _bitCast(name, arg)
    {
        const argType = typeOf(arg);
        const from = CjsFxGlslTypes.glslScalar(argType.builtInType);
        const to = name === "asfloat" ? "float" : name === "asint" ? "int" : "uint";
        const text = this._expression(arg);
        if (from === to)
        {
            return text;
        }
        if (to === "float")
        {
            return from === "int" ? `intBitsToFloat(${text})` : `uintBitsToFloat(${text})`;
        }
        if (from === "float")
        {
            return to === "int" ? `floatBitsToInt(${text})` : `floatBitsToUint(${text})`;
        }
        return `${CjsFxGlslTypes.glslVector(to, argType.width)}(${text})`;
    }

    // ---------------------------------------------------------------------
    // Names
    // ---------------------------------------------------------------------

    /**
     * The GLSL name of a symbol.
     *
     * @param {object} symbol The symbol.
     * @returns {string} The name.
     */
    _nameOf(symbol)
    {
        return CjsFxGlslTypes.glslName(symbol.name.ToString());
    }
}

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

/**
 * The member symbols of a struct type.
 *
 * @param {Type} type The type.
 * @returns {object[]} Its members, in declaration order.
 */
function membersOf(type)
{
    const members = [];
    for (const memberNode of type.symbol.definition.GetChildren())
    {
        for (const nameNode of memberNode.GetChildren())
        {
            members.push(nameNode.GetSymbol());
        }
    }
    return members;
}

/**
 * The registers one structured-buffer element takes, a struct of `float4`s
 * being the only layout HLSL's tight packing and std140 agree on here.
 *
 * @param {Type} type The element type.
 * @returns {number} The vec4 count.
 */
function elementRows(type)
{
    const members = type.IsStruct() ? membersOf(type) : [];
    if (members.length === 0 || members.some(member => !member.type.IsVector() || member.type.width !== 4 || member.type.builtInType !== T.OP_FLOAT || member.type.arrayDimensions > 0))
    {
        throw new Error(`CjsFxOutputGLSL: structured buffer element ${type.ToString()} is not a struct of float4, which is not supported yet`);
    }
    return members.length;
}

/**
 * The name and index of a stage member's semantic, in upper case as DXBC
 * reflection holds them.
 *
 * @param {object} member The member's symbol.
 * @returns {{ name: string, index: number }} The semantic.
 */
function semanticOf(member)
{
    const [ , name, index ] = /^(.*?)(\d*)$/u.exec(member.semantic.ToString().toUpperCase());
    return { name, index: index === "" ? 0 : Number(index) };
}

/**
 * The name both stages give a varying, by its semantic.
 *
 * @param {object} member The member's symbol.
 * @returns {string} The name.
 */
function varyingName(member)
{
    const { name, index } = semanticOf(member);
    return `v_${name}${index}`;
}

/**
 * The interpolation qualifier of a varying. Integers cannot interpolate, and
 * GLSL ES 3.00 has no `noperspective`.
 *
 * @param {object} member The member's symbol.
 * @returns {string} The qualifier with a trailing space, or "".
 */
function interpolationOf(member)
{
    if (member.interpolationModifier === T.OP_NOPERSPECTIVE)
    {
        throw new Error(`CjsFxOutputGLSL: noperspective varying ${member.name.ToString()} is not supported yet`);
    }
    const integer = CjsFxGlslTypes.glslScalar(member.type.builtInType) !== "float";
    return integer || member.interpolationModifier === T.OP_NOINTERPOLATION ? "flat " : "";
}
