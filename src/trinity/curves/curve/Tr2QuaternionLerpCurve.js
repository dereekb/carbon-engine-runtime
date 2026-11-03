import { exposure as be } from "#be";
// Source: trinity/trinity/Curves/Tr2QuaternionLerpCurve.h
// Source: trinity/trinity/Curves/Tr2QuaternionLerpCurve.cpp
import { num } from "#math/num";
import { quat } from "#math/quat";
import { ITriFunction, ITriQuaternionFunction, ITriCurveLength } from "#blue";
import { type, blue } from "#schema";
import { CcpTime } from "#blue";


/**
 * Quaternion curve that spherically interpolates between two child quaternion
 * curves, ramping the blend from 0 to 1 over `length` seconds starting at
 * `start` (a Blue time) and clamping outside that window.
 */
@be.define({
  name: "Tr2QuaternionLerpCurve",
  inherit: [ ITriCurveLength ],
  // Tr2QuaternionLerpCurve_Blue.cpp:10-35, in Carbon's order.
  interfaces: [ ITriFunction, ITriQuaternionFunction, ITriCurveLength ],
  members: [
    [ be.ATTR, "start", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "length", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "value", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "startCurve", be.READWRITE | be.PERSIST ],
    [ be.ATTR, "endCurve", be.READWRITE | be.PERSIST ]
  ]
})
export class Tr2QuaternionLerpCurve extends ITriQuaternionFunction
{
  /**
   * m_start (Be::Time): the blend-window start, in Blue 100ns ticks (Tr2QuaternionLerpCurve.h:16). Held as a
   * Number, as every Be::Time is (blue-clock-epoch).
   * @type {number}
   */

  @type.float64
  start = 0;

  /**
   * Blend duration in seconds; a nonpositive duration leaves the sampling destination unchanged.
   * @type {number}
   */

  @type.float32
  length = 0;

  /**
   * Cached quaternion (x, y, z, w), updated by Update and UpdateValue; retained when blending
   * cannot produce a sample.
   * @type {Float32Array}
   */

  @type.quat
  value = quat.create();

  /**
   * Optional quaternion function supplying the blend's starting orientation at the requested
   * sample time.
   * @type {ITriQuaternionFunction|null}
   */

  @type.object.ref("ITriQuaternionFunction")
  startCurve = null;

  /**
   * Optional quaternion function supplying the blend's ending orientation at the requested sample
   * time.
   * @type {ITriQuaternionFunction|null}
   */

  @type.object.ref("ITriQuaternionFunction")
  endCurve = null;

  /**
   * Reusable JavaScript quaternion buffer for the starting function's sample.
   * @type {Float32Array}
   */
  _startValue = quat.create();

  /**
   * Reusable JavaScript quaternion buffer for the ending function's sample.
   * @type {Float32Array}
   */
  _endValue = quat.create();

  /**
   * Updates the cached value for the supplied time.
   *
   * @implemented
   * @param {number} time Time in seconds.
   * @returns {void}
   */

  UpdateValue(time)
  {
    this.Update(time, this.value);
  }

  /**
   * Updates the cache and copies it into the caller-owned output.
   * JavaScript combines native time overloads with seconds first and output last.
   *
   * @adapted
   * @param {number} time Time in seconds.
   * @param {Float32Array} out Destination value.
   * @returns {Float32Array} The destination.
   */

  Update(time, out)
  {
    this.GetValueAt(time, this.value);
    return quat.copy(out, this.value);
  }

  /**
   * Carbon's GetValueAt(double): samples into the caller-owned output without updating the cache
   * (Tr2QuaternionLerpCurve.cpp:62-80). The blend delta is the seconds time less TimeAsDouble(m_start), narrowed to
   * float, and both children sample at the seconds time.
   *
   * @adapted the output is the last argument and is returned, rather than Carbon's leading pointer.
   * @param {number} time Time in seconds.
   * @param {Float32Array} out Destination value.
   * @returns {Float32Array} The destination.
   */
  GetValueAt(time, out)
  {
    if (!this.startCurve || !this.endCurve || this.length <= 0)
    {
      return out;
    }
    const delta = Math.fround(time - CcpTime.timeAsDouble(this.start));
    const ratio = num.clamp(Math.fround(delta / this.length), 0, 1);
    const start = this.startCurve.GetValueAt(time, this._startValue);
    const end = this.endCurve.GetValueAt(time, this._endValue);
    return quat.slerp(out, start, end, ratio);
  }

  /**
   * Carbon's Update(Be::Time): samples through the Be::Time GetValueAt into the cache (Tr2QuaternionLerpCurve.cpp:21-28).
   * JavaScript cannot overload on argument type, so the Be::Time overload has its own name.
   *
   * @adapted
   * @param {number} time Scene time in Blue 100ns ticks.
   * @param {Float32Array} out Destination value.
   * @returns {Float32Array} The destination.
   */
  Update__Ticks(time, out)
  {
    this.GetValueAt__Ticks(time, this.value);
    return quat.copy(out, this.value);
  }

  /**
   * Carbon's GetValueAt(Be::Time): the blend delta is TimeAsFloat(now - m_start), both in ticks, and both children
   * sample through their Be::Time overloads (cpp:41-59).
   * JavaScript cannot overload on argument type, so the Be::Time overload has its own name.
   *
   * @adapted
   * @param {number} time Scene time in Blue 100ns ticks.
   * @param {Float32Array} out Destination value.
   * @returns {Float32Array} The destination.
   */
  GetValueAt__Ticks(time, out)
  {
    if (!this.startCurve || !this.endCurve || this.length <= 0)
    {
      return out;
    }
    const delta = CcpTime.timeAsFloat(time - this.start);
    const ratio = num.clamp(Math.fround(delta / this.length), 0, 1);
    const start = this.startCurve.GetValueAt__Ticks(time, this._startValue);
    const end = this.endCurve.GetValueAt__Ticks(time, this._endValue);
    return quat.slerp(out, start, end, ratio);
  }

  /**
   * Retains the native no-op first derivative, leaving output unchanged.
   *
   * @adapted
   * @param {number} _time Unused time in seconds.
   * @param {Float32Array} out Destination value.
   * @returns {Float32Array} The unchanged destination.
   */
  GetValueDotAt(_time, out)
  {
    return out;
  }

  /**
   * Retains the native no-op second derivative, leaving output unchanged.
   *
   * @adapted
   * @param {number} _time Unused time in seconds.
   * @param {Float32Array} out Destination value.
   * @returns {Float32Array} The unchanged destination.
   */
  GetValueDoubleDotAt(_time, out)
  {
    return out;
  }

  /**
   * Gets the authored blend duration.
   *
   * @implemented
   * @returns {number} Duration in seconds.
   */

  Length()
  {
    return this.length;
  }
}

// Exact native exposure table; no inherited or implicit entries.
