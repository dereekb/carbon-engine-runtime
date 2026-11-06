// Not in Carbon: HLSL types and names as GLSL ES 3.00 spells them, for the
// WebGL2 target; the counterpart of CjsFxWgslTypes.js. HLSL `floatRxC` is
// GLSL's `matCxR`, the same matrix WGSL's `matCxR<f32>` is.

import { HLSLParserTokens } from "../hlslParserTokens.js";

const T = HLSLParserTokens;

/**
 * GLSL ES 3.00's keywords and reserved words (GLSL ES 3.00 spec 3.6), and the
 * built-in functions a declaration would hide or redefine.
 */
const RESERVED = new Set(`attribute const uniform varying layout centroid flat smooth break continue do for while switch
case default if else in out inout float int void bool true false invariant discard return mat2 mat3 mat4 mat2x2 mat2x3
mat2x4 mat3x2 mat3x3 mat3x4 mat4x2 mat4x3 mat4x4 vec2 vec3 vec4 ivec2 ivec3 ivec4 bvec2 bvec3 bvec4 uint uvec2 uvec3 uvec4
lowp mediump highp precision sampler2D sampler3D samplerCube sampler2DShadow samplerCubeShadow sampler2DArray
sampler2DArrayShadow isampler2D isampler3D isamplerCube isampler2DArray usampler2D usampler3D usamplerCube usampler2DArray
struct attribute coherent volatile restrict readonly writeonly resource atomic_uint noperspective patch sample subroutine
common partition active asm class union enum typedef template this goto inline noinline public static extern external
interface long short double half fixed unsigned superp input output hvec2 hvec3 hvec4 dvec2 dvec3 dvec4 fvec2 fvec3 fvec4
sampler3DRect filter image1D image2D image3D imageCube iimage1D iimage2D iimage3D iimageCube uimage1D uimage2D uimage3D
uimageCube image1DArray image2DArray iimage1DArray iimage2DArray uimage1DArray uimage2DArray imageBuffer iimageBuffer
uimageBuffer sampler1D sampler1DShadow sampler1DArray sampler1DArrayShadow isampler1D isampler1DArray usampler1D
usampler1DArray sampler2DRect sampler2DRectShadow isampler2DRect usampler2DRect samplerBuffer isamplerBuffer usamplerBuffer
sampler2DMS isampler2DMS usampler2DMS sampler2DMSArray isampler2DMSArray usampler2DMSArray sizeof cast namespace using
packed main
radians degrees sin cos tan asin acos atan sinh cosh tanh asinh acosh atanh pow exp log exp2 log2 sqrt inversesqrt abs
sign floor trunc round roundEven ceil fract mod modf min max clamp mix step smoothstep isnan isinf floatBitsToInt
floatBitsToUint intBitsToFloat uintBitsToFloat packSnorm2x16 unpackSnorm2x16 packUnorm2x16 unpackUnorm2x16 packHalf2x16
unpackHalf2x16 length distance dot cross normalize faceforward reflect refract matrixCompMult outerProduct transpose
determinant inverse lessThan lessThanEqual greaterThan greaterThanEqual equal notEqual any all not textureSize texture
textureProj textureLod textureOffset texelFetch texelFetchOffset textureProjOffset textureLodOffset textureProjLod
textureProjLodOffset textureGrad textureGradOffset textureProjGrad textureProjGradOffset dFdx dFdy fwidth`.split(/\s+/u));

/**
 * HLSL types and identifiers as GLSL text. Not instantiated; every member is
 * static.
 */
export class CjsFxGlslTypes
{
    /** Stable name independent of minification; no registry is required. */
    static className = "CjsFxGlslTypes";

    /**
     * The GLSL scalar of an HLSL scalar token.
     *
     * @param {number} builtInType A scalar type token.
     * @returns {string|null} `float`, `int`, `uint` or `bool`, or null for a non-scalar token.
     */
    static glslScalar(builtInType)
    {
        switch (builtInType)
        {
            case T.OP_FLOAT:
            case T.OP_HALF:
            case T.OP_DOUBLE:
                return "float";
            case T.OP_INT:
                return "int";
            case T.OP_UINT:
                return "uint";
            case T.OP_BOOL:
                return "bool";
            default:
                return null;
        }
    }

    /**
     * A GLSL vector of a scalar.
     *
     * @param {string} scalar A GLSL scalar.
     * @param {number} width The component count.
     * @returns {string} The type, the scalar itself for one component.
     */
    static glslVector(scalar, width)
    {
        if (width === 1)
        {
            return scalar;
        }
        const prefix = { float: "", int: "i", uint: "u", bool: "b" }[scalar];
        return `${prefix}vec${width}`;
    }

    /**
     * The sampler uniform of an HLSL texture type, or null when WebGL2 has none.
     *
     * @param {import("../Type.js").Type} type A texture type.
     * @returns {{ sampler: string, dimensionName: string }|null} The GLSL type and the backend block's dimension.
     */
    static glslTexture(type)
    {
        const sampled = type.templateParameter ? CjsFxGlslTypes.glslScalar(type.templateParameter.builtInType) : "float";
        const prefix = sampled === "int" ? "i" : sampled === "uint" ? "u" : "";
        switch (type.builtInType)
        {
            case T.OP_TEXTURE:
            case T.OP_TEXTURE2D:
            case T.OP_DEPTHTEXTURE2D:
                return { sampler: `${prefix}sampler2D`, dimensionName: "texture2d" };
            case T.OP_TEXTURE2DARRAY:
            case T.OP_DEPTHTEXTURE2DARRAY:
                return { sampler: `${prefix}sampler2DArray`, dimensionName: "texture2darray" };
            case T.OP_TEXTURE3D:
                return { sampler: `${prefix}sampler3D`, dimensionName: "texture3d" };
            case T.OP_TEXTURECUBE:
                return { sampler: `${prefix}samplerCube`, dimensionName: "texturecube" };
            default:
                return null;
        }
    }

    /**
     * The GLSL type text of an HLSL type, without array dimensions.
     *
     * @param {import("../Type.js").Type} type The type.
     * @param {(symbol: object) => string} nameOf The GLSL name of a struct symbol.
     * @returns {string} The type text.
     */
    static glslElementType(type, nameOf)
    {
        if (type.IsStruct())
        {
            return nameOf(type.symbol);
        }
        const scalar = CjsFxGlslTypes.glslScalar(type.builtInType);
        if (scalar !== null)
        {
            // Rows are `width`, columns `height`: HLSL floatRxC is GLSL matCxR.
            return type.IsMatrix() ? `mat${type.height}x${type.width}` : CjsFxGlslTypes.glslVector(scalar, type.width);
        }
        if (type.builtInType === T.OP_VOID)
        {
            return "void";
        }
        if (type.IsTexture())
        {
            const texture = CjsFxGlslTypes.glslTexture(type);
            if (texture !== null)
            {
                return texture.sampler;
            }
        }
        throw new Error(`CjsFxGlslTypes: ${type.ToString()} has no GLSL type`);
    }

    /**
     * The GLSL type text of an HLSL type, array dimensions included
     * (`float a[3]` is `float[3]`). GLSL ES 3.00 has no arrays of arrays.
     *
     * @param {import("../Type.js").Type} type The type.
     * @param {(symbol: object) => string} nameOf The GLSL name of a struct symbol.
     * @returns {string} The type text.
     */
    static glslType(type, nameOf)
    {
        if (type.arrayDimensions > 1)
        {
            throw new Error(`CjsFxGlslTypes: ${type.ToString()} is an array of arrays, which GLSL ES 3.00 does not have`);
        }
        const element = CjsFxGlslTypes.glslElementType(type, nameOf);
        return type.arrayDimensions === 1 ? `${element}[${type.arraySizes[0]}]` : element;
    }

    /**
     * A GLSL identifier for an HLSL one. GLSL ES reserves names containing `__`
     * (which Carbon's generated names use: `__StageInData_0004`), and names
     * starting `gl_` or, in WebGL, `webgl_` and `_webgl_`; those and its
     * reserved words get the prefix `cjs_`, and each `__` becomes `_u_`.
     *
     * @param {string} name The HLSL name.
     * @returns {string} The GLSL name.
     */
    static glslName(name)
    {
        if (name.includes("__"))
        {
            return `cjs${name.startsWith("_") ? "" : "_"}${name.replace(/_{2,}/gu, "_u_")}`;
        }
        if (RESERVED.has(name) || /^(?:gl_|webgl_|_webgl_)/u.test(name))
        {
            return `cjs_${name}`;
        }
        return name;
    }
}
