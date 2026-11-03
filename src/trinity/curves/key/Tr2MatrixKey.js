import { exposure as be } from "#be";
import { IRoot } from "../../../blue/blueexposure/IRoot.js";
// Source: trinity/trinity/Curves/Tr2BoneMatrixCurve.h
// Source: trinity/trinity/Curves/Tr2BoneMatrixCurve_Blue.cpp
// Source: trinity/trinity/include/Tr2Curve.h:26-33
import { mat4 } from "#math/mat4";
import { type, blue } from "#schema";


/**
 * One key of a matrix curve: a time in seconds and the 4x4 matrix value at that
 * time.
 * Adapted: the Tr2Key<Matrix> data members are stored directly; no behavioral
 * base is needed. Zero time remains a deterministic JS default for the native
 * uninitialized scalar. The identity matrix matches Matrix's default constructor
 * (math/include/Matrix_inline.h:7-11).
 */
@be.define({
  name: "Tr2MatrixKey",
  inherit: [ IRoot ],
  // Tr2BoneMatrixCurve_Blue.cpp:11-16, in Carbon's order.
  members: [
    [ be.ATTR, "time", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "value", be.READWRITE | be.PERSIST ]
  ]
})
export class Tr2MatrixKey extends IRoot
{
  /** Key time in seconds. */

  @type.float32
  time = 0;

  /** Owned matrix storage; each key has a distinct buffer. */

  @type.mat4
  value = mat4.create();

}

// Native own query table; no inherited exposure chain.
