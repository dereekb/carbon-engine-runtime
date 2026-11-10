import { vec3 } from "#math/vec3";

/** Blue time is in 100 ns ticks. */
const TICKS_PER_SECOND = 1e7;

/**
 * A ship's translation curve that moves it in a straight line at a set
 * velocity. Ours: in the EVE client the ship's position comes from the
 * client's own ball (bound as `translationCurve`, EveSpaceObject2.cpp:3063-3067),
 * which is proprietary client code; this stands in for it. The ship calls it
 * as Carbon calls any translation curve (`Update__Ticks`, `GetValueDotAt__Ticks`),
 * so its world velocity, and `EveShip2.speed` from it, follow the motion.
 */
export class TnyMotion
{
    static className = "TnyMotion";

    /** World velocity in metres per second. */
    velocity = vec3.create();

    /** Position at `_originTicks`. */
    _origin = vec3.create();

    /** The Blue time `_origin` holds for; null until the first update. */
    _originTicks = null;

    /** The last time asked for, so a velocity change continues from there. */
    _lastTicks = null;

    /**
     * Changes the velocity from the last frame's position on.
     *
     * @param {number[]} velocity World velocity, metres per second.
     */
    SetVelocity(velocity)
    {
        if (this._lastTicks !== null)
        {
            this.GetValueAt__Ticks(this._lastTicks, this._origin);
            this._originTicks = this._lastTicks;
        }
        vec3.copy(this.velocity, velocity);
    }

    /**
     * Position at a Blue time.
     *
     * @param {bigint|number} time Blue ticks.
     * @param {Float32Array} out Receives the position.
     * @returns {Float32Array} `out`.
     */
    GetValueAt__Ticks(time, out)
    {
        if (this._originTicks === null) this._originTicks = time;
        // Blue's epoch is 2026-01-01, so tick counts stay exact as doubles.
        const seconds = (Number(time) - Number(this._originTicks)) / TICKS_PER_SECOND;
        return vec3.scaleAndAdd(out, this._origin, this.velocity, seconds);
    }

    /** Position at a time in seconds since the motion started; seconds as Carbon's untimed GetValueAt. */
    GetValueAt(time, out)
    {
        return vec3.scaleAndAdd(out, this._origin, this.velocity, time);
    }

    /** Advances to a Blue time and writes the position (Carbon's Update for a translation curve). */
    Update__Ticks(time, out)
    {
        this._lastTicks = time;
        return this.GetValueAt__Ticks(time, out);
    }

    /** The velocity: the position's first derivative. */
    GetValueDotAt__Ticks(_time, out)
    {
        return vec3.copy(out, this.velocity);
    }

    /** Straight-line motion has no acceleration. */
    GetValueDoubleDotAt__Ticks(_time, out)
    {
        return vec3.set(out, 0, 0, 0);
    }
}
