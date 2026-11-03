import { exposure as be } from "#be";
import { IRoot } from "../../../blue/exposure/IRoot.js";
// Source: trinity/trinity/Curves/TriEventKey.h
// Source: trinity/trinity/Curves/TriEventKey.cpp
// Source: trinity/trinity/Curves/TriEventKey_Blue.cpp
import { type } from "#schema";


/**
 * One key of a TriEventCurve: a time in seconds plus either a named event string
 * or a callable and its arguments to invoke when the playhead crosses it.
 */
@be.define({
  name: "TriEventKey",
  inherit: [ IRoot ],
  // TriEventKey_Blue.cpp:10-33, in Carbon's order.
  members: [
    [ be.ATTR, "time", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "value", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "callable", be.READWRITE ],
    [ be.ATTR, "callableArgs", be.READWRITE ]
  ]
})
export class TriEventKey extends IRoot
{
  /** Event time in seconds. */

  @type.float32
  time = 0;

  /** Native wide event string, persisted independently of the callable. */

  @type.wstring
  value = "";

  /**
   * Host callable; JavaScript GC replaces native Py_XDECREF ownership.
   *
   * @adapted
   */
  /** Carbon: m_callable (trinity/trinity/Curves/TriEventKey.h:22).
   * Adapted: Python values use ordinary JavaScript callables; they are not IRoot objects.
   */
  @type.unknown
  callable = null;

  /**
   * Host callable arguments; runtime-only and owned through ordinary JS references.
   *
   * @adapted
   */
  /** Carbon: m_callableArgs (trinity/trinity/Curves/TriEventKey.h:23).
   * Adapted: Python values use ordinary JavaScript argument arrays; they are not IRoot objects.
   */
  @type.array("unknown")
  callableArgs = null;
}

// Native own query table; no inherited exposure chain.
